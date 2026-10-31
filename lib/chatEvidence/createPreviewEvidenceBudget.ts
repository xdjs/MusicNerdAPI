import type { LanguageModelMiddleware } from "ai";
import { getPreviewSettlement } from "./getPreviewSettlement";
import { lookupPreviewGeneration } from "./lookupPreviewGeneration";
type StreamResult = Awaited<
  ReturnType<Parameters<NonNullable<LanguageModelMiddleware["wrapStream"]>>[0]["doStream"]>
>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer P> ? P : never;
type PreviewFinish = Extract<StreamPart, { type: "finish" }>;

/** Preview experiment admission estimate, not an invoice or provider billing guarantee. */
export function createPreviewEvidenceBudget(
  capture: (receipt: Record<string, unknown>) => void,
  lookup = lookupPreviewGeneration,
) {
  // Nanodollars avoid floating-point admission errors. Input includes a 1-hour
  // cache-write allowance at 2x the listed regional input rate; no cache discount.
  const limit = 150_000_000;
  const inputRate = 4_400;
  const outputRate = 11_000;
  const requestId = crypto.randomUUID();
  let reserved = 0;
  let observed = 0;
  let attempts = 0;
  let reconciled = 0;
  let failed = false;
  let complete = false;
  let diagnostics = 0;
  const generations = new Set<string>();
  const unsettled: Array<{
    step: number;
    generationId: string;
    input: number;
    output: number;
    finishReason: string;
    reservation: number;
  }> = [];
  let admitting = false;
  let remainingLookupMs = 2000;
  const emit = (receipt: Record<string, unknown>) => {
    try {
      capture({
        version: 2,
        requestId,
        estimateOnly: true,
        limitUsd: 0.15,
        reservedUsd: reserved / 1e9,
        observedUpperEstimateUsd: observed / 1e9,
        ...receipt,
      });
    } catch {
      failed = true;
      throw new Error("Preview budget capture failed");
    }
  };
  const stop = (reason: string, details: Record<string, number | string> = {}): never => {
    failed = true;
    emit({ phase: "stopped", reason, attempts, reconciled, ...details });
    throw new Error("Preview evidence budget stopped");
  };
  const count = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    wrapStream: async ({ params, doStream }) => {
      if (failed || complete || admitting || attempts !== reconciled)
        return stop("previous_outcome_uncertain");
      if (attempts >= 6) return stop("step_limit");
      if (
        !count(params.maxOutputTokens) ||
        params.maxOutputTokens < 1 ||
        params.maxOutputTokens > 1024
      )
        return stop("output_limit_missing");
      let bytes: number;
      try {
        // Count the complete SDK-prepared system/messages/tool schemas/options,
        // not just user prose. UTF-8 bytes plus framing is deliberately an
        // overestimate heuristic, not a provider tokenizer upper-bound theorem.
        bytes = Buffer.byteLength(JSON.stringify(params), "utf8");
      } catch {
        return stop("count_failed");
      }
      const inputTokens = bytes + 2048;
      const reservation = inputTokens * inputRate + params.maxOutputTokens * outputRate;
      if (!Number.isSafeInteger(reservation)) return stop("count_failed");
      if (reserved + reservation > limit && unsettled.length && remainingLookupMs > 0) {
        admitting = true;
        const started = performance.now();
        const deadline = AbortSignal.timeout(remainingLookupMs);
        const signal = params.abortSignal
          ? AbortSignal.any([deadline, params.abortSignal])
          : deadline;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let lookupFailure = "receipt_unavailable";
        let lookupHttpStatus: number | undefined;
        try {
          const reconcile = async () => {
            for (const prior of [...unsettled]) {
              if (signal.aborted || failed) throw new Error("Cancelled lookup");
              let value: unknown;
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  lookupFailure = "receipt_unavailable";
                  lookupHttpStatus = undefined;
                  value = await lookup(prior.generationId, signal);
                  break;
                } catch (error) {
                  if (error && typeof error === "object") {
                    const detail = error as { receiptCode?: unknown; httpStatus?: unknown };
                    if (
                      [
                        "receipt_client",
                        "receipt_scope",
                        "receipt_network",
                        "receipt_read",
                        "receipt_oversized",
                        "receipt_http",
                        "receipt_json",
                        "receipt_shape",
                        "receipt_sdk_schema",
                        "receipt_aborted",
                      ].includes(String(detail.receiptCode))
                    )
                      lookupFailure = String(detail.receiptCode);
                    if (
                      lookupFailure === "receipt_http" &&
                      typeof detail.httpStatus === "number" &&
                      Number.isInteger(detail.httpStatus) &&
                      detail.httpStatus >= 100 &&
                      detail.httpStatus <= 599
                    )
                      lookupHttpStatus = detail.httpStatus;
                  }
                  if (attempt || signal.aborted) throw new Error("Receipt unavailable");
                  // At most one readiness retry. The shared deadline bounds this wait.
                  await new Promise<void>((resolve, reject) => {
                    const done = () => {
                      clearTimeout(t);
                      reject(new Error("Aborted"));
                    };
                    const t = setTimeout(() => {
                      signal.removeEventListener("abort", done);
                      resolve();
                    }, 200);
                    signal.addEventListener("abort", done, { once: true });
                  });
                }
              }
              if (signal.aborted || failed) throw new Error("Cancelled lookup");
              const settlement = getPreviewSettlement(value, prior, code => {
                lookupFailure = code;
              });
              if (settlement === null) throw new Error("Receipt mismatch");
              if (settlement > prior.reservation) return stop("reservation_underestimated");
              const next = reserved - prior.reservation + settlement;
              emit({
                phase: "settled",
                step: prior.step,
                generationId: prior.generationId,
                settlementUsd: settlement / 1e9,
                reportedTotalUsd: (value as Record<string, unknown>).gateway_cost,
                reportedSurchargeUsd: (value as Record<string, unknown>).surcharge_cost,
                reservedUsd: next / 1e9,
              });
              reserved = next;
              unsettled.shift();
              if (reserved + reservation <= limit) break;
            }
          };
          await Promise.race([
            reconcile(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Receipt deadline")), remainingLookupMs);
            }),
          ]);
          if (signal.aborted || failed) return stop("accounting_unavailable");
          emit({ phase: "accounting_checked", elapsedMs: Math.ceil(performance.now() - started) });
        } catch {
          if (failed) throw new Error("Preview evidence budget stopped");
          return stop(
            params.abortSignal?.aborted ? "accounting_aborted" : "accounting_unavailable",
            {
              elapsedMs: Math.ceil(performance.now() - started),
              lookupFailure: params.abortSignal?.aborted
                ? "receipt_aborted"
                : deadline.aborted
                  ? "receipt_deadline"
                  : lookupFailure,
              ...(lookupHttpStatus === undefined ? {} : { lookupHttpStatus }),
            },
          );
        } finally {
          clearTimeout(timer);
          remainingLookupMs = Math.max(
            0,
            remainingLookupMs - Math.ceil(performance.now() - started),
          );
          admitting = false;
        }
      }
      if (params.abortSignal?.aborted) return stop("accounting_aborted");
      if (reserved + reservation > limit)
        return stop("reservation_limit", {
          nextStep: attempts + 1,
          preparedBytes: bytes,
          inputTokenEstimate: inputTokens,
          outputTokens: params.maxOutputTokens,
          nextReservationUsd: reservation / 1e9,
          remainingReservationUsd: (limit - reserved) / 1e9,
        });
      reserved += reservation;
      attempts++;
      const step = attempts;
      emit({
        phase: "reserved",
        step,
        inputTokenEstimate: inputTokens,
        preparedBytes: bytes,
        outputTokens: params.maxOutputTokens,
      });
      let finished = false;
      let pending: PreviewFinish | undefined;
      let providerTool = false;
      let generationId: string | null = null;
      try {
        const result = await doStream();
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream({
              transform(part, controller) {
                if (part.type === "finish") {
                  const input = part.usage.inputTokens.total;
                  const output = part.usage.outputTokens.total;
                  const id = part.providerMetadata?.gateway?.generationId;
                  if (typeof id === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(id))
                    generationId = id;
                  if (finished || !count(input) || !count(output)) return stop("usage_missing");
                  if (input > inputTokens || output > params.maxOutputTokens!)
                    return stop("reservation_underestimated");
                  finished = true;
                  pending = part;
                  if (!["stop", "tool-calls"].includes(part.finishReason.unified))
                    return stop("abnormal_finish");
                }
                if ("providerExecuted" in part && part.providerExecuted) providerTool = true;
                if (part.type === "error") return stop("provider_error");
                controller.enqueue(part);
              },
              flush() {
                if (!pending || !finished) return stop("stream_incomplete");
                if (failed || params.abortSignal?.aborted) return stop("outcome_uncertain");
                const input = pending.usage.inputTokens.total!;
                const output = pending.usage.outputTokens.total!;
                const usageEstimate = input * inputRate + output * outputRate;
                // Completion records usage but holds its reservation. Only a
                // later blocked admission may reconcile this exact generation.
                emit({
                  phase: "reconciled",
                  step,
                  inputTokens: input,
                  outputTokens: output,
                  generationId,
                  finishReason: pending.finishReason.unified,
                  accounting: "reservation_retained",
                  settlementUsd: null,
                  observedUpperEstimateUsd: (observed + usageEstimate) / 1e9,
                });
                if (!providerTool && generationId && !generations.has(generationId)) {
                  unsettled.push({
                    step,
                    generationId,
                    input,
                    output,
                    finishReason: pending.finishReason.unified,
                    reservation,
                  });
                }
                if (generationId) generations.add(generationId);
                observed += usageEstimate;
                reconciled++;
              },
            }),
          ),
        };
      } catch {
        return stop("provider_outcome_uncertain");
      }
    },
    wrapGenerate: async () => stop("nonstream_call_disallowed"),
  };
  return {
    middleware,
    recordTool: (toolName: string, stage: "called" | "returned" | "error", output?: unknown) => {
      if (failed) return;
      if (++diagnostics > 48) return stop("diagnostic_limit");
      const name = ["searchSources", "readSource", "selectPassage"].includes(toolName)
        ? toolName
        : "unknown";
      let outcome = "unclassified";
      if (stage === "returned" && output && typeof output === "object") {
        const value = output as Record<string, unknown>;
        if (
          typeof value.status === "string" &&
          [
            "displayed",
            "unavailable",
            "context_unavailable",
            "cancelled",
            "validation_failed",
          ].includes(value.status)
        )
          outcome = value.status;
        else if ("passageId" in value) outcome = "passage_available";
        else if (Array.isArray(value.sources)) outcome = "sources_returned";
      }
      emit({ phase: "tool", sequence: diagnostics, tool: name, stage, outcome });
    },
    failed: () => failed,
    finish: () => {
      if (failed || complete) return;
      if (!attempts || attempts !== reconciled) return stop("outcome_uncertain");
      emit({ phase: "complete", attempts, reconciled });
      complete = true;
    },
  };
}

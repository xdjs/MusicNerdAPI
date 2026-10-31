import type { LanguageModelMiddleware } from "ai";
type StreamResult = Awaited<
  ReturnType<Parameters<NonNullable<LanguageModelMiddleware["wrapStream"]>>[0]["doStream"]>
>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer P> ? P : never;
type PreviewFinish = Extract<StreamPart, { type: "finish" }>;

/** Preview experiment admission estimate, not an invoice or provider billing guarantee. */
export function createPreviewEvidenceBudget(capture: (receipt: Record<string, unknown>) => void) {
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
      if (failed || complete || attempts !== reconciled) return stop("previous_outcome_uncertain");
      if (
        params.tools?.some(
          t =>
            t.type !== "function" ||
            !["searchSources", "readSource", "selectPassage"].includes(t.name),
        )
      )
        return stop("unsupported_tools");
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
                  const consistent = (total: number, parts: (number | undefined)[]) => {
                    const known = parts.filter(p => p !== undefined);
                    if (known.some(p => !count(p))) return false;
                    const sum = known.reduce((a, b) => a + b, 0);
                    return sum <= total && (known.length !== parts.length || sum === total);
                  };
                  if (
                    !consistent(input, [
                      part.usage.inputTokens.noCache,
                      part.usage.inputTokens.cacheRead,
                      part.usage.inputTokens.cacheWrite,
                    ]) ||
                    !consistent(output, [
                      part.usage.outputTokens.text,
                      part.usage.outputTokens.reasoning,
                    ])
                  )
                    return stop("usage_inconsistent");
                  if (generationId && generations.has(generationId))
                    return stop("duplicate_generation");
                  if (input > inputTokens || output > params.maxOutputTokens!)
                    return stop("reservation_underestimated");
                  finished = true;
                  pending = part;
                  if (!["stop", "tool-calls"].includes(part.finishReason.unified))
                    return stop("abnormal_finish");
                }
                if ("providerExecuted" in part && part.providerExecuted)
                  return stop("unsupported_provider_tool");
                if (part.type === "error") return stop("provider_error");
                controller.enqueue(part);
              },
              flush() {
                if (!pending || !finished) return stop("stream_incomplete");
                if (failed || params.abortSignal?.aborted) return stop("outcome_uncertain");
                const input = pending.usage.inputTokens.total!;
                const output = pending.usage.outputTokens.total!;
                const usageEstimate = input * inputRate + output * outputRate;
                // Total output already includes reasoning. Charge all input at
                // the cache-write allowance; never count reasoning twice. This
                // estimates visible usage, not unknown attempts or extra fees.
                const next = reserved - reservation + usageEstimate;
                emit({
                  phase: "reconciled",
                  step,
                  inputTokens: input,
                  outputTokens: output,
                  generationId,
                  finishReason: pending.finishReason.unified,
                  accounting: "estimated_usage",
                  settlementUsd: usageEstimate / 1e9,
                  reservedUsd: next / 1e9,
                  observedUpperEstimateUsd: (observed + usageEstimate) / 1e9,
                });
                reserved = next;
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

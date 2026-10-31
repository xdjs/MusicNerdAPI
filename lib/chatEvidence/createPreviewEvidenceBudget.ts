import type { LanguageModelMiddleware } from "ai";

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
  const emit = (receipt: Record<string, unknown>) => {
    try {
      capture({
        version: 1,
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
  const stop = (reason: string): never => {
    failed = true;
    emit({ phase: "stopped", reason, attempts, reconciled });
    throw new Error("Preview evidence budget stopped");
  };
  const count = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    wrapStream: async ({ params, doStream }) => {
      if (failed || attempts !== reconciled) return stop("previous_outcome_uncertain");
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
      if (!Number.isSafeInteger(reservation) || reserved + reservation > limit)
        return stop("reservation_limit");
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
                  observed += input * inputRate + output * outputRate;
                  if (
                    input > inputTokens ||
                    output > params.maxOutputTokens! ||
                    observed > reserved
                  )
                    return stop("reservation_underestimated");
                  reconciled++;
                  finished = true;
                  emit({
                    phase: "reconciled",
                    step,
                    inputTokens: input,
                    outputTokens: output,
                    generationId,
                    finishReason: part.finishReason.unified,
                  });
                  if (!["stop", "tool-calls"].includes(part.finishReason.unified))
                    return stop("abnormal_finish");
                }
                if (part.type === "error") return stop("provider_error");
                controller.enqueue(part);
              },
              flush() {
                if (!finished) stop("stream_incomplete");
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
    failed: () => failed,
    finish: () => {
      if (failed) return;
      if (!attempts || attempts !== reconciled) return stop("outcome_uncertain");
      emit({ phase: "complete", attempts, reconciled });
    },
  };
}

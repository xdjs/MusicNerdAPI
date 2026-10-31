import { MODEL_CHAT } from "@/lib/ai/const";
/** Validate an exact historical receipt against a clean completed SDK step. */
export function getPreviewSettlement(
  receipt: unknown,
  step: {
    generationId: string;
    input: number;
    output: number;
    finishReason: string;
  },
) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null;
  const r = receipt as Record<string, unknown>;
  const whole = (x: unknown): x is number =>
    typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
  const dollars = (x: unknown): number | null => {
    if (typeof x !== "number" || !Number.isFinite(x) || x < 0) return null;
    const n = Math.ceil(x * 1e9);
    return Number.isSafeInteger(n) ? n : null;
  };
  if (
    r.id !== step.generationId ||
    r.model !== MODEL_CHAT ||
    r.provider_name !== "anthropic" ||
    r.streamed !== true ||
    r.finish_reason !== step.finishReason
  )
    return null;
  const tokens = [
    r.native_tokens_prompt,
    r.native_tokens_completion,
    r.native_tokens_reasoning,
    r.native_tokens_cached,
    r.native_tokens_cache_creation,
    r.billable_web_search_calls,
  ];
  if (
    !tokens.every(whole) ||
    r.native_tokens_prompt !== step.input ||
    (r.native_tokens_completion as number) + (r.native_tokens_reasoning as number) !==
      step.output ||
    (r.native_tokens_cached as number) + (r.native_tokens_cache_creation as number) > step.input ||
    r.billable_web_search_calls !== 0
  )
    return null;
  const inference = dollars(r.total_cost);
  const surcharge = dollars(r.surcharge_cost);
  const total = dollars(r.gateway_cost);
  if (
    inference === null ||
    surcharge === null ||
    total === null ||
    Math.abs(total - inference - surcharge) > 2
  )
    return null;
  // All input includes cache writes at the conservative upper rate; output
  // includes reasoning once. Preserve external charges, never discount them.
  const estimate = step.input * 4400 + step.output * 11000;
  const settlement = Math.max(total, estimate + surcharge);
  return Number.isSafeInteger(settlement) ? settlement : null;
}

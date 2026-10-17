import { NoObjectGeneratedError } from "ai";
/** Diagnose truncation/schema failures without logging model text, prompts, or artist answers. */
export function getInterviewModelOutputDiagnostic(error: unknown) {
  if (!NoObjectGeneratedError.isInstance(error)) return {};
  const reasons = new Set([
    "stop",
    "length",
    "content-filter",
    "tool-calls",
    "error",
    "other",
    "unknown",
  ]);
  return {
    finishReason: reasons.has(error.finishReason ?? "unknown") ? error.finishReason : "unknown",
    inputTokens: error.usage?.inputTokens ?? null,
    outputTokens: error.usage?.outputTokens ?? null,
  };
}

import type { QuestionResearchState } from "@/lib/questionResearch/types";

/** Persist only bounded, non-content diagnostics for a failed server-side research slice. */
export function getResearchFailureDiagnostic(error: unknown, step: QuestionResearchState["step"]) {
  const value = error && typeof error === "object" ? error : {};
  const name = "name" in value ? value.name : null;
  const knownNames = new Set([
    "Error",
    "TypeError",
    "SyntaxError",
    "AbortError",
    "TimeoutError",
    "AI_APICallError",
    "AI_NoObjectGeneratedError",
    "AI_InvalidResponseDataError",
  ]);
  const rawStatus =
    "statusCode" in value ? value.statusCode : "status" in value ? value.status : null;
  return {
    ...("finishReason" in value &&
    typeof value.finishReason === "string" &&
    ["stop", "length", "content-filter", "tool-calls", "error", "other", "unknown"].includes(
      value.finishReason,
    )
      ? { finishReason: value.finishReason }
      : {}),
    ...("cause" in value &&
    value.cause &&
    typeof value.cause === "object" &&
    "name" in value.cause &&
    typeof value.cause.name === "string" &&
    ["AI_TypeValidationError", "AI_JSONParseError", "SyntaxError"].includes(value.cause.name)
      ? { causeName: value.cause.name }
      : {}),
    step: step ?? "saved",
    name: typeof name === "string" && knownNames.has(name) ? name : "UnknownError",
    status:
      typeof rawStatus === "number" &&
      Number.isInteger(rawStatus) &&
      rawStatus >= 100 &&
      rawStatus <= 599
        ? rawStatus
        : null,
  };
}

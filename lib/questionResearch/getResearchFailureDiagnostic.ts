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

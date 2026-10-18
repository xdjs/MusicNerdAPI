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
  const allowedFields = new Set([
    "candidates",
    "references",
    "evidenceId",
    "revision",
    "sourceId",
    "entryId",
    "quote",
    "premiseAudit",
    "coverage",
    "question",
    "angle",
    "observation",
    "intendedUnknown",
    "rationale",
    "connection",
    "premise",
    "status",
    "reason",
    "supported",
    "timeScopeSupported",
    "faithfulToLatestAnswer",
    "respectsBoundaries",
    "novelAgainstHistory",
    "addsNewInformation",
    "oneClearAsk",
  ]);
  const validationPaths: string[] = [];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
    const record = cause as { issues?: unknown; cause?: unknown };
    if (Array.isArray(record.issues)) {
      for (const issue of record.issues.slice(0, 12)) {
        if (!issue || typeof issue !== "object" || !Array.isArray(issue.path)) continue;
        validationPaths.push(
          issue.path
            .slice(0, 5)
            .map((part: unknown) =>
              typeof part === "number"
                ? "[]"
                : typeof part === "string" && allowedFields.has(part)
                  ? part
                  : "field",
            )
            .join("."),
        );
      }
    }
    cause = record.cause;
  }
  return {
    finishReason: reasons.has(error.finishReason ?? "unknown") ? error.finishReason : "unknown",
    inputTokens: error.usage?.inputTokens ?? null,
    outputTokens: error.usage?.outputTokens ?? null,
    validationPaths,
  };
}

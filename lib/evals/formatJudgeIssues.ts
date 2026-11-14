import type { AnswerVerdict } from "@/lib/evals/answerVerdictSchema";

/** The judge's closed-vocabulary findings as a log line body. Enum values and integers only: the free-text `reason` is never read, since the log is public. */
export function formatJudgeIssues(verdict: AnswerVerdict): string {
  return `judge: issues=[${verdict.issues.join("; ")}] unsupported=[${verdict.unsupportedCitations.join(", ")}] missing=${verdict.missingRequired}`;
}

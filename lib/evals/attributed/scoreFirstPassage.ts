/** Raw received-passage latency; never reuse the legacy first-text budget. */
export function scoreFirstPassage(
  turn: {
    firstPassageMs?: number;
    attribution?: { state: string };
    error?: string;
  },
  approved?: { thresholdMs: number; approvalReference: string },
) {
  if (!turn.attribution) return null;
  const validApproval =
    approved &&
    Number.isFinite(approved.thresholdMs) &&
    approved.thresholdMs > 0 &&
    approved.approvalReference.trim();
  const measured = Number.isFinite(turn.firstPassageMs) && turn.firstPassageMs! >= 0;
  const complete = !turn.error && turn.attribution.state === "complete-transport";
  return {
    name: "first_substantive_passage",
    score:
      validApproval && measured && complete
        ? Number(turn.firstPassageMs! <= approved!.thresholdMs)
        : null,
    metadata: {
      firstPassageMs: measured ? turn.firstPassageMs : null,
      thresholdMs: validApproval ? approved!.thresholdMs : null,
      approvalReference: validApproval ? approved!.approvalReference : null,
      status: !validApproval
        ? "blocked_missing_approved_threshold"
        : !complete
          ? "unscored_incomplete_transport"
          : !measured
            ? "unscored_missing_passage"
            : "scored_against_approved_threshold",
    },
  };
}

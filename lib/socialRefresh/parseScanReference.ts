import type { ScanReference } from "./types";
/** Reject malformed persisted references rather than manufacture a safe cursor. */
export function parseScanReference(value: unknown): ScanReference | undefined {
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  if (
    !Array.isArray(row.anchors) ||
    row.anchors.length > 3 ||
    typeof row.observedAt !== "string" ||
    !Number.isFinite(Date.parse(row.observedAt)) ||
    !(
      row.gapSince === null ||
      (typeof row.gapSince === "string" && Number.isFinite(Date.parse(row.gapSince)))
    )
  )
    return;
  if (
    row.recoveryAttemptedAt !== undefined &&
    (typeof row.recoveryAttemptedAt !== "string" ||
      !Number.isFinite(Date.parse(row.recoveryAttemptedAt)) ||
      row.gapSince === null)
  )
    return;
  const anchors = [];
  for (const value of row.anchors) {
    if (!value || typeof value !== "object") return;
    const anchor = value as Record<string, unknown>;
    if (
      typeof anchor.id !== "string" ||
      !anchor.id ||
      typeof anchor.postedAt !== "string" ||
      !Number.isFinite(Date.parse(anchor.postedAt)) ||
      Date.parse(anchor.postedAt) > Date.parse(row.observedAt)
    )
      return;
    anchors.push({ id: anchor.id, postedAt: anchor.postedAt });
  }
  if (new Set(anchors.map(a => a.id)).size !== anchors.length) return;
  return {
    anchors,
    observedAt: row.observedAt,
    gapSince: row.gapSince as string | null,
    ...(typeof row.recoveryAttemptedAt === "string"
      ? { recoveryAttemptedAt: row.recoveryAttemptedAt }
      : {}),
  };
}

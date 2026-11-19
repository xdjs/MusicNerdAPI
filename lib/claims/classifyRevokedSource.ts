/** A Lore source as revocation reads it. */
export type RevokedSource = {
  id: string;
  artistId: string;
  activityId: string | null;
  origin: string;
  filePath: string | null;
};

/** The activity event a source was recorded with. */
export type RevokedSourceActivity = {
  id: string;
  artistId: string;
  sourceId: string | null;
  actorUserId: string | null;
  actorKind: string;
  action: string;
  trigger: string;
};

/**
 * Decides what a revocation does with one of the artist's Lore sources, as
 * MusicNerdWeb does: a verified trusted submission stays, the claimant's own
 * upload or submission and generated research go, and anything whose
 * provenance can't be shown needs review, which stops the revocation.
 * Retention never depends on publication, moderation or current roles.
 *
 * @param source - The source.
 * @param activity - The event the source points to, or null when there is none.
 * @param claimantId - The revoked claimant.
 * @returns `retain`, `delete` or `review`.
 */
export function classifyRevokedSource(
  source: Omit<RevokedSource, "filePath">,
  activity: RevokedSourceActivity | null,
  claimantId: string,
): "retain" | "delete" | "review" {
  const expectedAction =
    source.origin === "upload"
      ? "source_upload"
      : source.origin === "submission"
        ? "source_submission"
        : null;
  const ownEvent =
    activity &&
    activity.id === source.activityId &&
    activity.artistId === source.artistId &&
    activity.sourceId === source.id;
  if (
    expectedAction &&
    ownEvent &&
    activity.actorKind === "user" &&
    activity.actorUserId &&
    activity.action === expectedAction
  ) {
    if (activity.trigger === "trusted_submission") return "retain";
    if (activity.actorUserId === claimantId) return "delete";
  }
  // Research is generated, not contributor-owned. Contradictory trusted
  // provenance is ambiguous and never becomes permission to delete.
  if (source.origin === "research" && activity?.trigger !== "trusted_submission") return "delete";
  return "review";
}

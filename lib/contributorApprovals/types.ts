/** One of a contributor's submissions: a link suggestion, a Lore source or an upload. */
export type ContributorSubmission = { id: string; type: "link" | "lore" | "upload" };

/** A pending submission as the admin's bulk review lists it. */
export type PendingSubmission = ContributorSubmission & {
  title: string | null;
  url: string | null;
  artistName: string | null;
};

/** What approving one submission changed, for the Lore refresh that follows. */
export type ApprovedSubmission =
  { artistId: string; lore: false } | { artistId: string; lore: true; claimId: string | null };

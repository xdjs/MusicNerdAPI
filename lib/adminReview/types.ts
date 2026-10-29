/** A kind of item waiting in the admin review queue. */
export type ReviewType = "links" | "sources" | "corrections";

/** The review queue's filters, as applied. */
export type ReviewQueueQuery = { type: ReviewType | "all"; query: string; page: number };

/** One pending item in the admin review queue. */
export type ReviewItem = {
  type: ReviewType;
  id: string;
  artistId: string;
  artistName: string | null;
  title: string | null;
  url: string | null;
  createdAt: string | null;
  origin: string;
  actorKind: string | null;
  actorName: string | null;
  actorId: string | null;
  activityId: string | null;
  trigger: string | null;
  bioSnapshot: string | null;
  details: string | null;
  reason: string | null;
};

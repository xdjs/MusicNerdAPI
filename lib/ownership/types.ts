import type { db } from "@/lib/db/db";

/** Who an artist operation runs as, and under which claim. */
export type ArtistOperationOwnership = {
  /** The approved claim the operation started under; every write re-checks it. */
  expectedClaimId: string | null;
  /** The acting user; a non-claimant must be an admin. */
  userId?: string;
  trigger?: string;
  activityId?: string;
  sourceOrigin?: "research" | "submission" | "upload";
};

/** The operation's store: its ownership plus the artist it is scoped to. */
export type ArtistOperation = ArtistOperationOwnership & { artistId: string };

/** A transaction handle, as `db.transaction` passes it. */
export type TransactionDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What a scoped write may use: the transaction inside an operation, the client outside one. */
export type ScopedWriteDb = Pick<
  typeof db,
  "query" | "select" | "insert" | "update" | "delete" | "execute"
>;

/** The user and claim a write is authorized against. */
export type ArtistWriteAuth = { userId: string; expectedClaimId: string | null };

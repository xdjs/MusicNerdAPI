import type { db } from "@/lib/db/db";

/** What an advisory lock needs: the transaction's execute. */
export type ArtistIdentityLockExecutor = Pick<typeof db, "execute">;

/** What a link write needs from its transaction or client. */
export type ArtistLinkExecutor = Pick<typeof db, "query" | "execute">;

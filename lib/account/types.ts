import type { db } from "@/lib/db/db";

/** One saved artist, as the bookmarks list returns it. */
export interface BookmarkItem {
  artistId: string;
  artistName: string;
  imageUrl: string | null;
}

/** The open transaction every bookmark write and the account merge run in. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Anything that can `select`: the database or an open transaction. */
export type ReadDatabase = Pick<typeof db, "select">;

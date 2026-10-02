import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { socialProfileHandle } from "@/lib/social/socialProfileHandle";
import type { SocialTask } from "@/lib/social/types";

/** Checks the current profile while the caller holds the artist/job write lock. */
export async function socialTaskIsConnected(
  artistId: string,
  task: SocialTask,
  writer: WriteDb,
): Promise<boolean> {
  const rows = rowsOf(
    await writer.execute(
      sql`select instagram, tiktok, x from artists where id = ${artistId}::uuid`,
    ),
  );
  const artist = rows[0] as
    { instagram?: string | null; tiktok?: string | null; x?: string | null } | undefined;
  if (!artist) throw new Error("could not read current social identity");
  return task.source === "reels"
    ? !!artist.instagram && normalizeHandle(artist.instagram) === normalizeHandle(task.handle)
    : socialProfileHandle(artist[task.source], task.source) === task.handle;
}

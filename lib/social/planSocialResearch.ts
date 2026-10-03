import { and, desc, eq } from "drizzle-orm";
import { getArtistById } from "@/lib/artists/getArtistById";
import { db } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";
import { selectReelsForTranscript } from "@/lib/social/selectReelsForTranscript";
import { socialProfileHandle } from "@/lib/social/socialProfileHandle";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import type { SocialTask } from "@/lib/social/types";

/** Snapshots connected profiles and missing reel context after Instagram collection. A read failure throws. */
export async function planSocialResearch(artistId: string, force: boolean): Promise<SocialTask[]> {
  const artist = await getArtistById(artistId);
  if (!artist) throw new Error("could not read social profiles");
  const tasks: SocialTask[] = [];
  for (const source of ["tiktok", "x"] as const) {
    const handle = socialProfileHandle(artist[source], source);
    if (!handle) continue;
    const existing = force
      ? []
      : await db
          .select({ id: artistSocialPosts.id })
          .from(artistSocialPosts)
          .where(
            and(eq(artistSocialPosts.artistId, artistId), eq(artistSocialPosts.platform, source)),
          )
          .limit(1);
    if (!existing.length) tasks.push({ source, handle });
  }
  const rows = await db.query.artistSocialPosts.findMany({
    where: and(
      eq(artistSocialPosts.artistId, artistId),
      eq(artistSocialPosts.platform, "instagram"),
    ),
    orderBy: [desc(artistSocialPosts.postedAt)],
    limit: 300,
  });
  const reels = selectReelsForTranscript(
    rows.filter(
      row =>
        artist.instagram &&
        normalizeHandle(row.ownerUsername) === normalizeHandle(artist.instagram),
    ),
  );
  if (reels.length) tasks.push({ source: "reels", handle: artist.instagram ?? "", reels });
  return tasks;
}

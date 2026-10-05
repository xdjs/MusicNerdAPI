import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";
import { rowsOf } from "@/lib/db/rowsOf";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { MAX_TRANSCRIPT_CHARS, type SocialTask } from "@/lib/social/types";

/** Attaches audio context only to an exact selected post; preserves captions and all prior metadata. */
export async function storeReelTranscript(
  item: unknown,
  artistId: string,
  task: SocialTask,
  writer: WriteDb,
): Promise<boolean> {
  if (!item || typeof item !== "object") return false;
  const raw = item as Record<string, unknown>;
  if (
    raw.error ||
    typeof raw.transcript !== "string" ||
    !raw.transcript.trim() ||
    typeof raw.ownerUsername !== "string" ||
    typeof raw.url !== "string"
  )
    return false;
  const target = task.reels?.find(
    r =>
      r.id === String(raw.id) &&
      normalizeHandle(r.owner) === normalizeHandle(raw.ownerUsername as string),
  );
  if (!target) return false;
  const shortcode = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port &&
        ["instagram.com", "www.instagram.com"].includes(u.hostname)
        ? /^\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)\/?$/.exec(u.pathname)?.[1]
        : undefined;
    } catch {
      return undefined;
    }
  };
  const code = shortcode(target.url);
  if (!code || code !== shortcode(raw.url)) return false;
  const transcript = JSON.stringify({
    version: 1,
    text: raw.transcript.trim().slice(0, MAX_TRANSCRIPT_CHARS),
    actor: "apify/instagram-reel-scraper",
    runId: task.runId,
    fetchedAt: new Date().toISOString(),
  });
  const result = await writer.execute(sql`update artist_social_posts
    set raw = coalesce(${artistSocialPosts.raw}, '{}'::jsonb) || jsonb_build_object('_musicnerdTranscript', ${transcript}::jsonb)
    where artist_id = ${artistId}::uuid and platform = 'instagram' and platform_post_id = ${target.id}
      and owner_username = ${target.owner} and is_own_post = true and url = ${target.url}
    returning id`);
  return rowsOf(result).length > 0;
}

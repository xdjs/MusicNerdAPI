import { dedupeExcludingSelf } from "@/lib/instagram/dedupeExcludingSelf";
import { extractMusic } from "@/lib/instagram/extractMusic";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { stringArray } from "@/lib/instagram/stringArray";
import { usernamesFrom } from "@/lib/instagram/usernamesFrom";
import type { ApifyPost, SocialPostInsert } from "@/lib/instagram/types";

/**
 * Maps one raw Apify dataset item to an insertable row. This is the single
 * place that decides `ownerUsername` / `isOwnPost`: a scraped feed includes
 * posts other people authored where the artist is a collaborator, and a
 * foreign owner's caption must never be attributed to the artist.
 *
 * @param rawItem - One item from the Apify dataset.
 * @param artistId - The artist the feed belongs to.
 * @param handle - The artist's Instagram handle.
 * @param artistName - The artist's real name, for dropping self-credited audio.
 * @returns The row, or null for Apify's error placeholders and items missing id, url or owner.
 */
export function mapApifyPost(
  rawItem: unknown,
  artistId: string,
  handle: string,
  artistName?: string,
): SocialPostInsert | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const raw = rawItem as ApifyPost;
  if (raw.error) return null;
  const { id, url, ownerUsername } = raw;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof url !== "string" || !url) return null;
  if (typeof ownerUsername !== "string" || !ownerUsername) return null;

  const selfNorm = normalizeHandle(handle);
  const storedRaw: Record<string, unknown> = { ...raw };
  // Never trust a scraper-provided value as evidence of a retained thumbnail.
  delete storedRaw._musicnerdThumbnail;
  return {
    artistId,
    platform: "instagram",
    platformPostId: String(id),
    ownerUsername,
    isOwnPost: normalizeHandle(ownerUsername) === selfNorm,
    caption: typeof raw.caption === "string" ? raw.caption : null,
    url,
    postedAt: typeof raw.timestamp === "string" ? raw.timestamp : null,
    likeCount: typeof raw.likesCount === "number" ? raw.likesCount : null,
    commentCount: typeof raw.commentsCount === "number" ? raw.commentsCount : null,
    playCount: typeof raw.videoPlayCount === "number" ? raw.videoPlayCount : null,
    hashtags: stringArray(raw.hashtags),
    mentions: dedupeExcludingSelf(
      [...stringArray(raw.mentions), ...usernamesFrom(raw.taggedUsers)],
      selfNorm,
    ),
    coauthors: dedupeExcludingSelf(usernamesFrom(raw.coauthorProducers), selfNorm),
    ...extractMusic(raw, ownerUsername, selfNorm, artistName),
    raw: storedRaw,
  };
}

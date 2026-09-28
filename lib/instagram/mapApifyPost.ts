import type { SocialPostInsert } from "@/lib/instagram/types";

interface ApifyPost {
  id?: unknown;
  url?: unknown;
  ownerUsername?: unknown;
  caption?: unknown;
  hashtags?: unknown;
  mentions?: unknown;
  taggedUsers?: unknown;
  coauthorProducers?: unknown;
  likesCount?: unknown;
  commentsCount?: unknown;
  videoPlayCount?: unknown;
  timestamp?: unknown;
  musicInfo?: unknown;
  error?: unknown;
}

interface ApifyMusicInfo {
  artist_name?: unknown;
  song_name?: unknown;
  uses_original_audio?: unknown;
}

const norm = (handle: string) => handle.trim().toLowerCase().replace(/^@/, "");

/**
 * Compares a DISPLAY NAME against a HANDLE, which `norm` cannot do: it keeps
 * spaces and punctuation, so "Pharaoh Sistare" never equals "pharaohsistare".
 * Deliberately lossy; handle-to-handle comparisons use `norm`.
 */
const normLoose = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "");

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

const usernamesFrom = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(entry => (entry && typeof entry === "object" ? entry.username : undefined))
        .filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

/** Dedupe by normalized handle and drop the artist's own handle. */
const dedupeExcludingSelf = (handles: string[], selfNorm: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of handles) {
    const key = norm(h);
    if (!key || key === selfNorm || seen.has(key)) continue;
    seen.add(key);
    out.push(h.trim().replace(/^@/, ""));
  }
  return out;
};

/**
 * musicInfo is noisy: most video posts carry it, but it is often the artist's
 * own original audio rather than a real track credit. A credit naming the
 * poster (by handle, display name or real name) is dropped: we cannot tell
 * "their own release" from "Instagram mislabelled the audio", and keeping it
 * once asked a real artist about a collaboration he had no part in.
 */
const extractMusic = (
  raw: ApifyPost,
  ownerUsername: string,
  selfNorm: string,
  realArtistName?: string,
): { musicTitle: string | null; musicArtist: string | null } => {
  const none = { musicTitle: null, musicArtist: null };
  const info = raw.musicInfo as ApifyMusicInfo | undefined;
  if (!info || typeof info !== "object") return none;
  const songName = typeof info.song_name === "string" ? info.song_name.trim() : "";
  const artistName = typeof info.artist_name === "string" ? info.artist_name.trim() : "";
  if (!songName || !artistName) return none;
  if (info.uses_original_audio === true || songName.toLowerCase() === "original audio") return none;
  const credited = normLoose(artistName);
  const isSelfCredit =
    credited === normLoose(selfNorm) ||
    credited === normLoose(ownerUsername) ||
    (!!realArtistName && credited === normLoose(realArtistName));
  return isSelfCredit ? none : { musicTitle: songName, musicArtist: artistName };
};

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

  const selfNorm = norm(handle);
  const storedRaw: Record<string, unknown> = { ...raw };
  // Never trust a scraper-provided value as evidence of a retained thumbnail.
  delete storedRaw._musicnerdThumbnail;
  return {
    artistId,
    platform: "instagram",
    platformPostId: String(id),
    ownerUsername,
    isOwnPost: norm(ownerUsername) === selfNorm,
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

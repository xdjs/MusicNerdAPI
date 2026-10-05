import type { SocialPostInsert } from "@/lib/instagram/types";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import type { ProfilePlatform } from "@/lib/social/types";

/** Maps documented actor fields; foreign authors and reposted speech are never artist captions. */
export function mapSocialPost(
  item: unknown,
  artistId: string,
  platform: ProfilePlatform,
  handle: string,
): SocialPostInsert | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (raw.error || raw.isRetweet === true || raw.isRepost === true) return null;
  const author = (platform === "x" ? raw.author : raw.authorMeta) as
    Record<string, unknown> | undefined;
  const owner = platform === "x" ? author?.userName : author?.name;
  const url = platform === "x" ? raw.url : raw.webVideoUrl;
  if (typeof owner !== "string" || normalizeHandle(owner) !== normalizeHandle(handle)) return null;
  if (
    (typeof raw.id !== "string" && typeof raw.id !== "number") ||
    !/^\d+$/.test(String(raw.id)) ||
    typeof url !== "string"
  )
    return null;
  try {
    const parsed = new URL(url);
    const hosts = platform === "x" ? ["x.com", "twitter.com"] : ["tiktok.com"];
    const path = platform === "x" ? `/${owner}/status/${raw.id}` : `/@${owner}/video/${raw.id}`;
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !hosts.includes(parsed.hostname.replace(/^www\./, "")) ||
      parsed.pathname.replace(/\/$/, "").toLowerCase() !== path.toLowerCase()
    )
      return null;
  } catch {
    return null;
  }
  const date =
    platform === "x"
      ? raw.createdAt
      : (raw.createTimeISO ??
        (typeof raw.createTime === "number" ? raw.createTime * 1000 : undefined));
  const postedAt = typeof date === "string" || typeof date === "number" ? new Date(date) : null;
  if (!postedAt || !Number.isFinite(postedAt.getTime())) return null;
  const text =
    platform === "x" && typeof raw.fullText === "string" && raw.fullText ? raw.fullText : raw.text;
  const caption = typeof text === "string" ? text : null;
  const metric = (key: string) =>
    typeof raw[key] === "number" && Number.isFinite(raw[key]) && raw[key] >= 0
      ? Math.min(2_147_483_647, Math.trunc(raw[key]))
      : null;
  const hashtags =
    platform === "tiktok" && Array.isArray(raw.hashtags)
      ? raw.hashtags.flatMap(h =>
          h && typeof h === "object" && typeof h.name === "string" ? [h.name] : [],
        )
      : [...(caption ?? "").matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1]);
  const storedRaw = { ...raw };
  delete storedRaw._musicnerdThumbnail;
  delete storedRaw._musicnerdTranscript;
  return {
    artistId,
    platform,
    platformPostId: String(raw.id),
    ownerUsername: owner,
    isOwnPost: true,
    caption,
    url,
    postedAt: postedAt.toISOString(),
    likeCount: metric(platform === "x" ? "likeCount" : "diggCount"),
    commentCount: metric(platform === "x" ? "replyCount" : "commentCount"),
    playCount: metric(platform === "x" ? "viewCount" : "playCount"),
    hashtags,
    mentions: [
      ...new Set(
        [...(caption ?? "").matchAll(/@([a-zA-Z0-9_.]+)/g)]
          .map(m => m[1])
          .filter(m => normalizeHandle(m) !== normalizeHandle(handle)),
      ),
    ],
    coauthors: [],
    musicTitle: null,
    musicArtist: null,
    raw: storedRaw,
  };
}

import type { ReelTarget } from "@/lib/social/types";
import { REEL_LIMIT } from "@/lib/social/types";

/** Selects a bounded set of own short reels whose caption supplies little context. */
export function selectReelsForTranscript(
  rows: {
    platformPostId: string;
    ownerUsername: string;
    isOwnPost: boolean;
    caption: string | null;
    url: string;
    raw: unknown;
  }[],
): ReelTarget[] {
  return rows
    .filter(row => {
      if (!row.isOwnPost || !row.raw || typeof row.raw !== "object") return false;
      const raw = row.raw as Record<string, unknown>;
      const prior = raw._musicnerdTranscript as { text?: unknown } | undefined;
      const prose = (row.caption ?? "").replace(/[#@][\p{L}\p{N}_.]+/gu, "").trim();
      return (
        raw.type === "Video" &&
        raw.productType === "clips" &&
        typeof raw.videoDuration === "number" &&
        raw.videoDuration > 0 &&
        raw.videoDuration <= 180 &&
        prose.length < 160 &&
        !(typeof prior?.text === "string" && prior.text.trim())
      );
    })
    .slice(0, REEL_LIMIT)
    .map(row => ({ id: row.platformPostId, url: row.url, owner: row.ownerUsername }));
}

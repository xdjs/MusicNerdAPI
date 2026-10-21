import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { appleMusicTrackLink } from "@/lib/trackLinks/appleMusicTrackLink";
import { CACHE_MAX, CACHE_TTL_MS, trackLinksCache } from "@/lib/trackLinks/const";
import { deezerTrackLink } from "@/lib/trackLinks/deezerTrackLink";
import { foldTrackText } from "@/lib/trackLinks/foldTrackText";
import type { TrackLink } from "@/lib/trackLinks/types";
import { validateTrackLinksQuery } from "@/lib/trackLinks/validateTrackLinksQuery";

/**
 * Handles GET /api/trackLinks: where else can you hear this record? Apple
 * Music and Deezer are searched at once and only a hit that is the same
 * record is returned. Only a completed search is cached: a provider failure
 * must not pin an empty answer in front of every later click for an hour.
 *
 * @param request - The GET request.
 * @returns 200 `{ links }` (`cached: true` from memory), or 400 or 500 `{ error }`.
 */
export async function getTrackLinksHandler(request: Request): Promise<Response> {
  const headers = getCorsHeaders();
  try {
    const query = validateTrackLinksQuery(new URL(request.url).searchParams);
    if (query instanceof NextResponse) return query;
    const { title, artist, isAlbum } = query;

    const key = `${foldTrackText(artist)}::${foldTrackText(title)}::${isAlbum ? "album" : "song"}`;
    const hit = trackLinksCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS)
      return NextResponse.json({ links: hit.links, cached: true }, { headers });

    const [apple, dz] = await Promise.all([
      appleMusicTrackLink(title, artist, isAlbum).catch(() => undefined),
      deezerTrackLink(title, artist, isAlbum).catch(() => undefined),
    ]);
    const links = [apple, dz].filter((l): l is TrackLink => !!l);

    const complete = apple !== undefined && dz !== undefined;
    if (complete) {
      if (trackLinksCache.size >= CACHE_MAX)
        trackLinksCache.delete(trackLinksCache.keys().next().value as string);
      trackLinksCache.set(key, { at: Date.now(), links });
    }
    return NextResponse.json({ links }, { headers });
  } catch (error) {
    console.error("[trackLinks]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}

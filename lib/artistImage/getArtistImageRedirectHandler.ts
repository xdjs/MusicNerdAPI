import { validateArtistImageId } from "@/lib/artistImage/validateArtistImageId";
import { findArtistByColumn } from "@/lib/artistLookups/findArtistByColumn";
import { lookupArtists } from "@/lib/artistLookups/lookupArtists";
import { customImageUrl } from "@/lib/artists/customImageUrl";
import { getArtistImage } from "@/lib/musicPlatform/getArtistImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

/**
 * Handles GET /api/artist/{id}/image as MusicNerdWeb did: a 307 to the
 * artist's own `https` upload (a relative path resolves against this
 * request), else their Spotify or Deezer portrait. Public artist imagery
 * loads separately from private profile data. Placeholder uploads and
 * malformed legacy values fall through to the providers; every answer but
 * the redirect is empty and uncached.
 *
 * @param request - The GET request.
 * @param id - The artist id from the path.
 * @returns 307, or an empty 400, 404 or 503.
 */
export async function getArtistImageRedirectHandler(
  request: Request,
  id: string,
): Promise<Response> {
  const cors = getCorsHeaders();
  const unavailable = (status: number) =>
    new Response(null, { status, headers: { ...cors, "Cache-Control": "no-store" } });
  const valid = validateArtistImageId(id);
  if (valid instanceof Response) return valid;
  try {
    const artist = await findArtistByColumn(lookupArtists.id, id);
    if (!artist) return unavailable(404);
    const custom = customImageUrl(artist.customImage);
    let portrait: string | null = null;
    if (custom && !/default|placeholder|musicnerdlogo/i.test(custom)) {
      try {
        const relative =
          custom.startsWith("/") && !custom.startsWith("//") && !custom.includes("\\");
        const candidate = relative ? new URL(custom, request.url) : new URL(custom);
        if (candidate.protocol === "https:" && !candidate.username && !candidate.password)
          portrait = candidate.toString();
      } catch {
        // Malformed legacy uploads must not suppress a valid provider portrait.
      }
    }
    let value = portrait;
    if (!value) {
      const headers = artist.spotify?.trim() ? await getSpotifyHeaders().catch(() => null) : null;
      value = await getArtistImage(
        { spotify: artist.spotify, deezer: artist.deezer, customImage: null },
        headers,
      );
    }
    if (!value) return unavailable(404);
    const url = new URL(value, request.url);
    if (url.protocol !== "https:" || url.username || url.password) return unavailable(404);
    return new Response(null, {
      status: 307,
      headers: { ...cors, Location: url.toString(), "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return unavailable(503);
  }
}

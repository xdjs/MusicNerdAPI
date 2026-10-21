import { LOOKUP_NOT_FOUND, LOOKUP_SERVER_ERROR } from "@/lib/artistLookups/const";
import { findArtistByColumn } from "@/lib/artistLookups/findArtistByColumn";
import { lookupArtists } from "@/lib/artistLookups/lookupArtists";
import { lookupText } from "@/lib/artistLookups/lookupText";
import { readLookupBody } from "@/lib/artistLookups/readLookupBody";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * The Deezer lookup (`findArtistByDeezerID`), with MusicNerdWeb's response
 * shapes: `{ result: row }`, or plain-text errors. Unlike the other exact
 * lookups, `bio` is claim-checked: the artist's own About once they hold an
 * approved claim, else the public directory About or null, so an unclaimed
 * artist's private draft never leaves the server.
 *
 * @param request - The POST request with `{ "deezerID": string }`.
 * @returns 200, 400, 404 or 500.
 */
export async function findArtistByDeezerIdHandler(request: Request): Promise<Response> {
  const deezerID = (await readLookupBody(request)).deezerID;
  if (typeof deezerID !== "string")
    return lookupText("Missing or invalid required parameters: deezerID", 400);
  try {
    const artist = await findArtistByColumn(lookupArtists.deezer, deezerID);
    if (!artist) return lookupText(LOOKUP_NOT_FOUND, 404);
    const claimed = await findApprovedClaim(db, artist.id);
    const directoryAbout = claimed ? null : await getPublicArtistAbout(artist.id);
    return Response.json(
      { result: { ...artist, bio: claimed ? artist.bio : (directoryAbout?.bio ?? null) } },
      { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("[artist lookup] deezerID", e);
    return lookupText(LOOKUP_SERVER_ERROR, 500);
  }
}

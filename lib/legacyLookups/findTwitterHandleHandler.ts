import { LEGACY_NOT_FOUND, LEGACY_SERVER_ERROR } from "@/lib/legacyLookups/const";
import { findLegacyArtistByWalletOrEns } from "@/lib/legacyLookups/findLegacyArtistByWalletOrEns";
import { legacyText } from "@/lib/legacyLookups/legacyText";
import { readLegacyBody } from "@/lib/legacyLookups/readLegacyBody";
import { searchLegacyArtistByName } from "@/lib/legacyLookups/searchLegacyArtistByName";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MISSING = "Missing or invalid required parameters: name or ethAddress";

/**
 * The legacy `findTwitterHandle`: an artist's X handle by `ethAddress` (which
 * wins) or by fuzzy `name`, in MusicNerdWeb's shapes. A name that matches
 * nothing answers 200 `{}`, as the website did.
 *
 * @param request - The POST request.
 * @returns 200 `{ result }` or `{}`, or a plain-text 400, 404 or 500.
 */
export async function findTwitterHandleHandler(request: Request): Promise<Response> {
  const { name, ethAddress } = await readLegacyBody(request);
  const headers = getCorsHeaders();
  try {
    if (typeof ethAddress === "string" && ethAddress) {
      const artist = await findLegacyArtistByWalletOrEns(ethAddress);
      if (!artist) return legacyText(LEGACY_NOT_FOUND, 404);
      return Response.json({ result: artist.x }, { headers });
    }
    if (typeof name === "string" && name) {
      const artist = await searchLegacyArtistByName(name);
      return Response.json({ result: artist?.x }, { headers });
    }
    return legacyText(MISSING, 400);
  } catch (e) {
    console.error("[legacy lookup] findTwitterHandle", e);
    return legacyText(LEGACY_SERVER_ERROR, 500);
  }
}

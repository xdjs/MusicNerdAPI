import { LOOKUP_NOT_FOUND, LOOKUP_SERVER_ERROR } from "@/lib/artistLookups/const";
import { findArtistByWalletOrEns } from "@/lib/artistLookups/findArtistByWalletOrEns";
import { lookupText } from "@/lib/artistLookups/lookupText";
import { readLookupBody } from "@/lib/artistLookups/readLookupBody";
import { searchArtistByName } from "@/lib/artistLookups/searchArtistByName";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MISSING = "Missing or invalid required parameters: name or ethAddress";

/**
 * `findTwitterHandle`: an artist's X handle by `ethAddress` (which
 * wins) or by fuzzy `name`, in MusicNerdWeb's shapes. A name that matches
 * nothing answers 200 `{}`, as the website did.
 *
 * @param request - The POST request.
 * @returns 200 `{ result }` or `{}`, or a plain-text 400, 404 or 500.
 */
export async function findTwitterHandleHandler(request: Request): Promise<Response> {
  const { name, ethAddress } = await readLookupBody(request);
  const headers = getCorsHeaders();
  try {
    if (typeof ethAddress === "string" && ethAddress) {
      const artist = await findArtistByWalletOrEns(ethAddress);
      if (!artist) return lookupText(LOOKUP_NOT_FOUND, 404);
      return Response.json({ result: artist.x }, { headers });
    }
    if (typeof name === "string" && name) {
      const artist = await searchArtistByName(name);
      return Response.json({ result: artist?.x }, { headers });
    }
    return lookupText(MISSING, 400);
  } catch (e) {
    console.error("[artist lookup] findTwitterHandle", e);
    return lookupText(LOOKUP_SERVER_ERROR, 500);
  }
}

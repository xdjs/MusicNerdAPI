import type { PgColumn } from "drizzle-orm/pg-core";
import { LOOKUP_NOT_FOUND, LOOKUP_SERVER_ERROR } from "@/lib/artistLookups/const";
import { findArtistByColumn } from "@/lib/artistLookups/findArtistByColumn";
import { lookupText } from "@/lib/artistLookups/lookupText";
import { readLookupBody } from "@/lib/artistLookups/readLookupBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * An exact-match artist lookup (`findArtistBySpotifyID`, `findArtistByIG`), with
 * MusicNerdWeb's response shapes: `{ result: row }`, or plain-text errors.
 *
 * @param request - The POST request.
 * @param field - The body field holding the value.
 * @param column - The `lookupArtists` column it matches.
 * @param missingMessage - MusicNerdWeb's 400 message for this endpoint.
 * @returns 200, 400, 404 or 500.
 */
export async function findArtistHandler(
  request: Request,
  field: string,
  column: PgColumn,
  missingMessage: string,
): Promise<Response> {
  const value = (await readLookupBody(request))[field];
  if (typeof value !== "string") return lookupText(missingMessage, 400);
  try {
    const artist = await findArtistByColumn(column, value);
    if (!artist) return lookupText(LOOKUP_NOT_FOUND, 404);
    return Response.json({ result: artist }, { headers: getCorsHeaders() });
  } catch (e) {
    console.error(`[artist lookup] ${field}`, e);
    return lookupText(LOOKUP_SERVER_ERROR, 500);
  }
}

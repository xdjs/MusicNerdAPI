import type { PgColumn } from "drizzle-orm/pg-core";
import { LEGACY_NOT_FOUND, LEGACY_SERVER_ERROR } from "@/lib/legacyLookups/const";
import { findLegacyArtist } from "@/lib/legacyLookups/findLegacyArtist";
import { legacyText } from "@/lib/legacyLookups/legacyText";
import { readLegacyBody } from "@/lib/legacyLookups/readLegacyBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * A legacy exact-match lookup (`findArtistBySpotifyID`, `findArtistByIG`), with
 * MusicNerdWeb's response shapes: `{ result: row }`, or plain-text errors.
 *
 * @param request - The POST request.
 * @param field - The body field holding the value.
 * @param column - The `legacyArtists` column it matches.
 * @param missingMessage - The legacy 400 message for this endpoint.
 * @returns 200, 400, 404 or 500.
 */
export async function findLegacyArtistHandler(
  request: Request,
  field: string,
  column: PgColumn,
  missingMessage: string,
): Promise<Response> {
  const value = (await readLegacyBody(request))[field];
  if (typeof value !== "string") return legacyText(missingMessage, 400);
  try {
    const artist = await findLegacyArtist(column, value);
    if (!artist) return legacyText(LEGACY_NOT_FOUND, 404);
    return Response.json({ result: artist }, { headers: getCorsHeaders() });
  } catch (e) {
    console.error(`[legacy lookup] ${field}`, e);
    return legacyText(LEGACY_SERVER_ERROR, 500);
  }
}

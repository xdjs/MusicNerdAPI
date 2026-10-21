import type { NextResponse } from "next/server";
import { z } from "zod";
import { bookmarkArtistIds } from "@/lib/account/const";
import { readBookmarkBody } from "@/lib/account/readBookmarkBody";

const schema = z
  .object({ orderedArtistIds: bookmarkArtistIds, removedArtistIds: bookmarkArtistIds })
  .strict();

/**
 * Reads `{ orderedArtistIds, removedArtistIds }`: up to 500 UUIDs each, lower-cased, and nothing else.
 *
 * @param request - The request.
 * @returns The draft order and the removals, or a 400 response.
 */
export async function validateEditBookmarksBody(
  request: Request,
): Promise<{ orderedArtistIds: string[]; removedArtistIds: string[] } | NextResponse> {
  return readBookmarkBody(request, schema);
}

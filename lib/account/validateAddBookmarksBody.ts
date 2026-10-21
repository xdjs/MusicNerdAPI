import { NextResponse } from "next/server";
import { z } from "zod";
import { bookmarkArtistIds } from "@/lib/account/const";
import { readBookmarkBody } from "@/lib/account/readBookmarkBody";

const schema = z.object({ artistIds: bookmarkArtistIds, import: z.boolean().optional() }).strict();

/**
 * Reads `{ artistIds, import? }`: up to 500 UUIDs, lower-cased, and nothing else.
 *
 * @param request - The request.
 * @returns The artists to add and whether this is an import, or a 400 response.
 */
export async function validateAddBookmarksBody(
  request: Request,
): Promise<{ artistIds: string[]; import: boolean } | NextResponse> {
  const body = await readBookmarkBody(request, schema);
  if (body instanceof NextResponse) return body;
  return { artistIds: body.artistIds, import: body.import ?? false };
}

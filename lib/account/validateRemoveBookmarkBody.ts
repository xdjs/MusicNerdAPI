import type { NextResponse } from "next/server";
import { z } from "zod";
import { bookmarkArtistId } from "@/lib/account/const";
import { readBookmarkBody } from "@/lib/account/readBookmarkBody";

const schema = z.object({ artistId: bookmarkArtistId }).strict();

/**
 * Reads `{ artistId }`: one UUID, lower-cased, and nothing else.
 *
 * @param request - The request.
 * @returns The artist to remove, or a 400 response.
 */
export async function validateRemoveBookmarkBody(
  request: Request,
): Promise<{ artistId: string } | NextResponse> {
  return readBookmarkBody(request, schema);
}

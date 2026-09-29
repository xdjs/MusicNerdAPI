import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Checks an artist id taken from the path.
 *
 * @param artistId - The path segment.
 * @returns The id, or a 400 response when it isn't a UUID.
 */
export function validateArtistId(artistId: string): string | NextResponse {
  if (z.uuid().safeParse(artistId).success) return artistId;
  return NextResponse.json(
    { status: "error", error: "artistId must be a UUID" },
    { status: 400, headers: getCorsHeaders() },
  );
}

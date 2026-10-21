import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The search body: a non-empty `query` and, optionally, the caller's
 * bookmarked artist ids (anything that isn't a string array reads as none,
 * as MusicNerdWeb read it).
 *
 * @param body - The parsed JSON body.
 * @returns The query and bookmarks, or a 400 with MusicNerdWeb's message.
 */
export function validateSearchArtistsBody(
  body: unknown,
): { query: string; bookmarkedArtistIds: string[] } | NextResponse {
  const result = z
    .object({
      query: z.string().min(1),
      bookmarkedArtistIds: z.array(z.string()).catch([]),
    })
    .safeParse(body);
  if (!result.success)
    return NextResponse.json(
      { error: "Invalid query parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  return result.data;
}

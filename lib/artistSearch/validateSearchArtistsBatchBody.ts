import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The batch search body: `query.artists`, or the one `query.artist`, trimmed
 * and de-duplicated, as MusicNerdWeb read it.
 *
 * @param body - The parsed JSON body.
 * @returns The names, or a 400 with MusicNerdWeb's message when none is left.
 */
export function validateSearchArtistsBatchBody(body: unknown): string[] | NextResponse {
  const result = z
    .object({
      query: z
        .object({
          artists: z.array(z.string()).optional().catch(undefined),
          artist: z.string().optional().catch(undefined),
        })
        .optional()
        .catch(undefined),
    })
    .safeParse(body);
  const query = result.success ? result.data.query : undefined;
  const artists = query?.artists ?? (typeof query?.artist === "string" ? [query.artist] : []);
  const cleaned = [...new Set(artists.map(q => q.trim()).filter(Boolean))];
  if (cleaned.length === 0)
    return NextResponse.json(
      { error: "No queries provided" },
      { status: 400, headers: getCorsHeaders() },
    );
  return cleaned;
}

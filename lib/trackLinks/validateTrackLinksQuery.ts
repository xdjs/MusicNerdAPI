import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * The track-links query: a title and an artist, each trimmed and at most 200
 * characters, and whether an album is wanted. No caller-supplied collaborator
 * list: untrusted input must not loosen the match.
 *
 * @param searchParams - The request's query.
 * @returns The title, artist and `isAlbum`, or a 400 with MusicNerdWeb's message.
 */
export function validateTrackLinksQuery(
  searchParams: URLSearchParams,
): { title: string; artist: string; isAlbum: boolean } | NextResponse {
  const { title, artist, kind } = z
    .object({ title: z.string().trim(), artist: z.string().trim(), kind: z.string() })
    .parse({
      title: searchParams.get("title") ?? "",
      artist: searchParams.get("artist") ?? "",
      kind: searchParams.get("kind") ?? "",
    });
  const headers = getCorsHeaders();
  if (!title || !artist)
    return NextResponse.json({ error: "title and artist are required" }, { status: 400, headers });
  if (title.length > 200 || artist.length > 200)
    return NextResponse.json({ error: "title or artist too long" }, { status: 400, headers });
  return { title, artist, isAlbum: kind === "album" };
}

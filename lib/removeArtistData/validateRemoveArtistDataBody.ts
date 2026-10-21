import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Validates a POST /api/removeArtistData body with MusicNerdWeb's messages.
 *
 * @param request - The request.
 * @returns `{ artistId, siteName }`, or a 400 `Invalid request body` / `artistId and siteName are required`.
 */
export async function validateRemoveArtistDataBody(
  request: Request,
): Promise<{ artistId: string; siteName: string } | NextResponse> {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  let body: { artistId?: unknown; siteName?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body");
  }
  const { artistId, siteName } = body ?? {};
  if (!artistId || !siteName || typeof artistId !== "string" || typeof siteName !== "string")
    return fail("artistId and siteName are required");
  return { artistId, siteName };
}

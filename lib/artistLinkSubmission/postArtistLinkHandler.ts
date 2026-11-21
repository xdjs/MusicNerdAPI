import { NextResponse } from "next/server";
import { submitArtistLink } from "@/lib/artistLinkSubmission/submitArtistLink";
import { validateArtistLinkBody } from "@/lib/artistLinkSubmission/validateArtistLinkBody";
import { getArtistById } from "@/lib/artists/getArtistById";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/artist/{id}/links: any signed-in user suggests a
 * platform link for the artist.
 *
 * @param request - The request; a Privy token and `{ url }`.
 * @param id - The artist id from the path.
 * @returns 200 `{ status, approved, siteName, platformName, message }`; 400, 401, 404, 409 or 500 `{ status, error }`.
 */
export async function postArtistLinkHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = validateArtistLinkBody(await request.json().catch(() => null), id);
    if (body instanceof NextResponse) return body;
    const artist = await getArtistById(body.artistId);
    if (!artist) return error("Artist not found", 404);
    const result = await submitArtistLink(artist, auth.userId, body.url);
    if ("error" in result) return error(result.error, result.status);
    return NextResponse.json({ status: "ok", ...result }, { status: 200, headers });
  } catch (e) {
    console.error("[artist/links] Error adding artist data", e);
    return error("Error adding artist data, please try again", 500);
  }
}

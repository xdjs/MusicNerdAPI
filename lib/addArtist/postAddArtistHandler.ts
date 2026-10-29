import { NextResponse } from "next/server";
import { addArtist } from "@/lib/addArtist/addArtist";
import { scheduleArtistAddedFollowUps } from "@/lib/addArtist/scheduleArtistAddedFollowUps";
import { validateAddArtistBody } from "@/lib/addArtist/validateAddArtistBody";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/artist: any signed-in user adds an artist from a Spotify
 * or Deezer id. A created artist's directory research is woken, and Discord
 * told, after the response.
 *
 * @param request - The request; a Privy token and `{ platformId, platform?, forceCreate? }`.
 * @returns 200 `{ status, result, message, ... }`; 400, 401, 404, 409 or 500 `{ status, error }`.
 */
export async function postAddArtistHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = validateAddArtistBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const outcome = await addArtist(auth.userId, body);
    if ("error" in outcome) return error(outcome.error, outcome.status);
    if (outcome.created && outcome.body.result === "created")
      scheduleArtistAddedFollowUps({
        origin: new URL(request.url).origin,
        userId: auth.userId,
        artistId: outcome.body.artistId,
        artistName: outcome.body.artistName,
        platform: body.platform,
        platformId: outcome.created.platformId,
        createdAt: outcome.created.createdAt,
      });
    return NextResponse.json({ status: "ok", ...outcome.body }, { status: 200, headers });
  } catch (e) {
    console.error("[artist] Error adding artist:", e);
    if (e instanceof Error && e.message.includes("duplicate"))
      return error("This artist is already in our database", 409);
    return error("Something went wrong on our end, please try again", 500);
  }
}

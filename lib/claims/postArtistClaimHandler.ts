import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { createArtistClaim } from "@/lib/claims/createArtistClaim";
import { userLabel } from "@/lib/claims/userLabel";
import { validateClaimArtistId } from "@/lib/claims/validateClaimArtistId";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/artist/{id}/claim: files the caller's pending claim on the
 * artist and tells the team on Discord.
 *
 * @param request - The request; a signed-in user's Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, referenceCode }`; 400, 401, 404, 409 or 500 with `{ status: "error", error }`.
 */
export async function postArtistClaimHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const artistId = validateClaimArtistId(id);
    if (artistId instanceof NextResponse) return artistId;
    const result = await createArtistClaim(auth.userId, artistId);
    if (result === "no_artist")
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    if (result === "claimed")
      return NextResponse.json(
        { status: "error", error: "This artist profile has already been claimed" },
        { status: 409, headers },
      );
    await sendDiscordMessage(
      `New claim request: ${result.referenceCode} | Artist ID: ${artistId} | User: ${await userLabel(auth.userId)}`,
    );
    return NextResponse.json(
      { status: "ok", referenceCode: result.referenceCode },
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[claims] claim error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

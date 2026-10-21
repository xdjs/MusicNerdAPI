import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { removeArtistData } from "@/lib/removeArtistData/removeArtistData";
import { validateRemoveArtistDataBody } from "@/lib/removeArtistData/validateRemoveArtistDataBody";
import { getUserById } from "@/lib/users/getUserById";

/**
 * Handles POST /api/removeArtistData: a whitelisted user or an admin empties
 * one platform column on any artist.
 * MusicNerdWeb answered every refusal with 403, the write's own failures
 * included; that is kept.
 *
 * @param request - The request; a Privy token and `{ artistId, siteName }`.
 * @returns 200 `{ status, success, message }`; 400, 401, 403 or 500 `{ status, error }`.
 */
export async function postRemoveArtistDataHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const body = await validateRemoveArtistDataBody(request);
    if (body instanceof NextResponse) return body;
    const { artistId, siteName } = body;
    const user = await getUserById(auth.userId);
    const result =
      user?.isAdmin || user?.isWhiteListed
        ? await removeArtistData(artistId, siteName)
        : ({ status: "error", message: "Unauthorized" } as const);
    if (result.status === "error")
      return NextResponse.json(
        { status: "error", error: result.message },
        { status: 403, headers },
      );
    return NextResponse.json(
      { status: "ok", success: true, message: result.message },
      { status: 200, headers },
    );
  } catch (error) {
    console.error("[removeArtistData] Error:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

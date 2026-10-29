import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { assignUserName } from "@/lib/users/assignUserName";
import { findOrCreateUserByPrivyId } from "@/lib/users/findOrCreateUserByPrivyId";

/**
 * GET /api/user/me: the caller's own user row and role flags, from the token
 * alone. A first call for a new Privy account creates the user, and an
 * account without a usable name gets a generated one, as MusicNerdWeb's
 * sign-in did.
 *
 * @param request - The request, with a Privy bearer token.
 * @returns 200 with the row, `needsLegacyLink` and `status: "ok"`, or 401 or 500.
 */
export async function getMeHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const token = getBearerToken(request);
    const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
    if (!privyUserId)
      return NextResponse.json(
        { status: "error", error: "Not signed in" },
        { status: 401, headers },
      );
    const user = await assignUserName(await findOrCreateUserByPrivyId(privyUserId));
    return NextResponse.json(
      { status: "ok", ...user, needsLegacyLink: !user.wallet && !user.legacyLinkDismissed },
      { headers },
    );
  } catch (error) {
    console.error("[API] get me error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

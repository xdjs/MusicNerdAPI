import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findOrCreateUserByPrivyId } from "@/lib/users/findOrCreateUserByPrivyId";

/**
 * The member approving an agent: a Privy access token in `Authorization:
 * Bearer`. A first sign-in creates the Music Nerd user, as GET /api/user/me does.
 *
 * @param request - The request.
 * @returns `{ userId }`, or a 401 response.
 */
export async function authenticateConsentUser(
  request: Request,
): Promise<{ userId: string } | NextResponse> {
  const token = getBearerToken(request);
  const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
  if (!privyUserId)
    return NextResponse.json(
      { status: "error", error: "Not signed in" },
      { status: 401, headers: getCorsHeaders() },
    );
  const user = await findOrCreateUserByPrivyId(privyUserId);
  return { userId: user.id };
}

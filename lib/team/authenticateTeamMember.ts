import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getPrivyUser } from "@/lib/auth/getPrivyUser";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";
import { findTeamMember } from "@/lib/team/findTeamMember";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Which team member is calling: a Privy access token in `Authorization:
 * Bearer`, whose Privy email must be on the team. Unlike `authenticateRequest`,
 * it needs no Music Nerd user, since teammates may never have used the site.
 *
 * @param request - The incoming request.
 * @returns `{ name }`, the member's name, or a 401 or 403 response.
 */
export async function authenticateTeamMember(
  request: Request,
): Promise<{ name: string } | NextResponse> {
  const headers = getCorsHeaders();
  const token = getBearerToken(request);
  const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
  if (!privyUserId)
    return NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401, headers });
  const email = (await getPrivyUser(privyUserId))?.email?.address;
  const name = email ? findTeamMember(email) : null;
  if (name) return { name };
  return NextResponse.json({ status: "error", error: "Not on the team" }, { status: 403, headers });
}

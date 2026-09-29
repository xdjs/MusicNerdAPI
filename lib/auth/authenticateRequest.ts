import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getUserByPrivyId } from "@/lib/auth/getUserByPrivyId";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Who is calling: a Privy access token in `Authorization: Bearer`, mapped to
 * the Music Nerd user. MusicNerdWeb's session cookie doesn't reach this
 * origin, so the browser sends the token instead (decided 2026-09-29).
 *
 * @param request - The incoming request.
 * @returns `{ userId }`, or a 401 response.
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ userId: string } | NextResponse> {
  const token = getBearerToken(request);
  const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
  const user = privyUserId ? await getUserByPrivyId(privyUserId) : undefined;
  if (user) return { userId: user.id };
  return NextResponse.json(
    { status: "error", error: "Not signed in" },
    { status: 401, headers: getCorsHeaders() },
  );
}

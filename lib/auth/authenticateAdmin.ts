import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getUserByPrivyId } from "@/lib/auth/getUserByPrivyId";
import { verifyPrivyAccessToken } from "@/lib/auth/verifyPrivyAccessToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Who is calling, when only an admin may: a Privy access token in
 * `Authorization: Bearer`, mapped to a Music Nerd user with `is_admin`.
 *
 * @param request - The incoming request.
 * @returns `{ userId }`, a 401 when not signed in, or a 403 for a non-admin.
 */
export async function authenticateAdmin(
  request: Request,
): Promise<{ userId: string } | NextResponse> {
  const token = getBearerToken(request);
  const privyUserId = token ? await verifyPrivyAccessToken(token) : null;
  const user = privyUserId ? await getUserByPrivyId(privyUserId) : undefined;
  if (!user)
    return NextResponse.json(
      { status: "error", error: "Not signed in" },
      { status: 401, headers: getCorsHeaders() },
    );
  if (!user.isAdmin)
    return NextResponse.json(
      { status: "error", error: "Admin access required" },
      { status: 403, headers: getCorsHeaders() },
    );
  return { userId: user.id };
}

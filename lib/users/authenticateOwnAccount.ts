import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Authenticates the caller and requires that `id` is their own account, as
 * MusicNerdWeb's user routes did: nobody, admins included, reads or changes
 * another account here.
 *
 * @param request - The incoming request, with a Privy bearer token.
 * @param id - The account id from the path.
 * @returns `{ userId }`, or a 401 or 403 response.
 */
export async function authenticateOwnAccount(
  request: Request,
  id: string,
): Promise<{ userId: string } | NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.userId !== id)
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  return auth;
}

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApprovedClaimByUserId } from "@/lib/users/getApprovedClaimByUserId";

/**
 * GET /api/user/has-claim: whether the caller has an approved artist claim.
 * Always 200: no token, a bad token or a database error all answer
 * `hasClaim: false`, as MusicNerdWeb did, so navigation never breaks on it.
 *
 * @param request - The request, optionally with a Privy bearer token.
 * @returns 200 `{ status: "ok", hasClaim, artistId }`.
 */
export async function getUserHasClaimHandler(request: Request) {
  const headers = getCorsHeaders();
  const none = () =>
    NextResponse.json({ status: "ok", hasClaim: false, artistId: null }, { headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return none();
    const claim = await getApprovedClaimByUserId(auth.userId);
    return NextResponse.json(
      { status: "ok", hasClaim: !!claim, artistId: claim?.artistId ?? null },
      { headers },
    );
  } catch {
    return none();
  }
}

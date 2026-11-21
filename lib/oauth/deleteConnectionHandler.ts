import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteOAuthGrant } from "@/lib/oauth/deleteOAuthGrant";

/**
 * Handles DELETE /api/oauth/connections/{id}: disconnects one of the
 * signed-in user's agents, whose tokens stop working at once. A connection
 * that is gone or isn't theirs is still a 200.
 *
 * @param request - The request; a Privy access token.
 * @param id - The connection's id.
 * @returns 200 `{ status }`; 401 or 500 `{ status: "error", error }`.
 */
export async function deleteConnectionHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    await deleteOAuthGrant(id, auth.userId);
    return NextResponse.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("[oauth] disconnect error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

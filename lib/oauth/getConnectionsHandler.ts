import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listOAuthConnections } from "@/lib/oauth/listOAuthConnections";

/**
 * Handles GET /api/oauth/connections: the signed-in user's connected agents.
 *
 * @param request - The request; a Privy access token.
 * @returns 200 `{ status, connections }`; 401 or 500 `{ status: "error", error }`.
 */
export async function getConnectionsHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const connections = await listOAuthConnections(auth.userId);
    return NextResponse.json({ status: "ok", connections }, { headers });
  } catch (error) {
    console.error("[oauth] connections error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

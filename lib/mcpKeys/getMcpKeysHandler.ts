import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getAllMcpKeys } from "@/lib/mcpKeys/getAllMcpKeys";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/mcp-keys: every key, newest first. The body is a
 * bare array, as MusicNerdWeb returned it; its admin reads it as one.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the array; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getMcpKeysHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const keys = await getAllMcpKeys();
    return NextResponse.json(keys, { status: 200, headers });
  } catch (e) {
    console.error("[mcp-keys] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

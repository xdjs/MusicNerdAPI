import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { createMcpKey } from "@/lib/mcpKeys/createMcpKey";
import { validateMcpKeyBody } from "@/lib/mcpKeys/validateMcpKeyBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/mcp-keys: creates a key and returns it, the only
 * time the raw key is available.
 *
 * @param request - The request; an admin's Privy token and `{ label }`.
 * @returns 201 with `{ status, rawKey, label }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function postMcpKeysHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const body = await validateMcpKeyBody(request);
    if (body instanceof NextResponse) return body;
    const created = await createMcpKey(body.label);
    // Return the raw key — this is the only time it's available
    return NextResponse.json({ status: "ok", ...created }, { status: 201, headers });
  } catch (e) {
    console.error("[mcp-keys] POST error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { revokeMcpKey } from "@/lib/mcpKeys/revokeMcpKey";
import { validateMcpKeyId } from "@/lib/mcpKeys/validateMcpKeyId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/mcp-keys/{id}/revoke.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The key id from the path.
 * @returns 200 with `{ status, message }`; 400, 401, 403, 404 or 500 with `{ status: "error", error }`.
 */
export async function postRevokeMcpKeyHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const keyId = validateMcpKeyId(id);
    if (keyId instanceof NextResponse) return keyId;
    if (!(await revokeMcpKey(keyId)))
      return NextResponse.json(
        { status: "error", error: "Key not found" },
        { status: 404, headers },
      );
    return NextResponse.json({ status: "ok", message: "Key revoked" }, { status: 200, headers });
  } catch (e) {
    console.error("[mcp-keys] revoke error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

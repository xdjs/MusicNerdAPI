import { NextResponse } from "next/server";
import { authenticateBoardMember } from "@/lib/board/authenticateBoardMember";
import { revokeBoardKey } from "@/lib/board/revokeBoardKey";
import { validateMcpKeyId } from "@/lib/mcpKeys/validateMcpKeyId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/board/keys/{id}/revoke: revokes one of the caller's agent keys.
 *
 * @param request - The request; a team member's Privy access token.
 * @param id - The key id from the path.
 * @returns 200 with `{ status, message }`; 400, 401, 403, 404 or 500 with `{ status: "error", error }`.
 */
export async function postRevokeBoardKeyHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const member = await authenticateBoardMember(request);
    if (member instanceof NextResponse) return member;
    const keyId = validateMcpKeyId(id);
    if (keyId instanceof NextResponse) return keyId;
    if (!(await revokeBoardKey(member.name, keyId)))
      return NextResponse.json(
        { status: "error", error: "Key not found" },
        { status: 404, headers },
      );
    return NextResponse.json({ status: "ok", message: "Key revoked" }, { status: 200, headers });
  } catch (e) {
    console.error("[board] revoke error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { authenticateBoardMember } from "@/lib/board/authenticateBoardMember";
import { getBoardKeys } from "@/lib/board/getBoardKeys";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/board/keys: the caller's working agent keys.
 *
 * @param request - The request; a team member's Privy access token.
 * @returns 200 with `{ status, keys }`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getBoardKeysHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const member = await authenticateBoardMember(request);
    if (member instanceof NextResponse) return member;
    const keys = await getBoardKeys(member.name);
    return NextResponse.json({ status: "ok", keys }, { status: 200, headers });
  } catch (e) {
    console.error("[board] keys GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { authenticateBoardMember } from "@/lib/board/authenticateBoardMember";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/board/member: whether the caller is on the team, and their board name.
 *
 * @param request - The request; a Privy access token.
 * @returns 200 with `{ status, name }`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getBoardMemberHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const member = await authenticateBoardMember(request);
    if (member instanceof NextResponse) return member;
    return NextResponse.json({ status: "ok", name: member.name }, { status: 200, headers });
  } catch (e) {
    console.error("[board] member error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

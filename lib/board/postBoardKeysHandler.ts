import { NextResponse } from "next/server";
import { authenticateBoardMember } from "@/lib/board/authenticateBoardMember";
import { createBoardKey } from "@/lib/board/createBoardKey";
import { validateBoardKeyBody } from "@/lib/board/validateBoardKeyBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/board/keys: makes an agent key for the caller and returns
 * its MCP URL, the only time the key is shown.
 *
 * @param request - The request; a team member's Privy access token and `{ agent }`.
 * @returns 201 with `{ status, id, agent, profile, url }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function postBoardKeysHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const member = await authenticateBoardMember(request);
    if (member instanceof NextResponse) return member;
    const body = await validateBoardKeyBody(request);
    if (body instanceof NextResponse) return body;
    const { id, rawKey } = await createBoardKey(member.name, body.agent);
    const url = `${new URL(request.url).origin}/api/board/mcp/${rawKey}`;
    return NextResponse.json(
      { status: "ok", id, agent: body.agent, profile: `${body.agent}-${member.name}`, url },
      { status: 201, headers },
    );
  } catch (e) {
    console.error("[board] keys POST error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

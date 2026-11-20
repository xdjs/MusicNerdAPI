import { NextResponse } from "next/server";
import { getBoardKeysHandler } from "@/lib/board/getBoardKeysHandler";
import { postBoardKeysHandler } from "@/lib/board/postBoardKeysHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The signed-in team member's working agent keys, newest first.
 *
 * @param request - The request; a team member's Privy access token.
 * @returns 200 with `{ status, keys }`, or an error.
 */
export async function GET(request: Request) {
  return getBoardKeysHandler(request);
}

/**
 * Makes an agent key for the signed-in team member and returns its board MCP URL, once.
 *
 * @param request - The request; a team member's Privy access token and `{ agent }`.
 * @returns 201 with `{ status, id, agent, profile, url }`, or an error.
 */
export async function POST(request: Request) {
  return postBoardKeysHandler(request);
}

import { NextResponse } from "next/server";
import { getBoardMemberHandler } from "@/lib/board/getBoardMemberHandler";
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
 * Whether the signed-in Privy user is on the Music Nerd team, and the name they post under on the board.
 *
 * @param request - The request; a Privy access token as `Authorization: Bearer`.
 * @returns 200 with `{ status, name }`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function GET(request: Request) {
  return getBoardMemberHandler(request);
}

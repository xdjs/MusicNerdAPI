import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { countUserUgc } from "@/lib/contributions/countUserUgc";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/ugcCount: how many links the signed-in user has submitted. Without
 * a valid token, and when the count can't be read, the count is 0 with a 200,
 * as on MusicNerdWeb.
 *
 * @param request - The request; a Privy token.
 * @returns 200 with `{ status, count }`.
 */
export async function getUgcCountHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      return NextResponse.json({ status: "ok", count: 0 }, { headers });
    const count = await countUserUgc(auth.userId);
    return NextResponse.json({ status: "ok", count }, { headers });
  } catch (error) {
    console.error("[ugcCount] Error:", error);
    return NextResponse.json({ status: "ok", count: 0 }, { headers });
  }
}

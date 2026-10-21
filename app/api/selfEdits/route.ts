import { NextResponse } from "next/server";
import { getSelfEditsHandler } from "@/lib/contributions/getSelfEditsHandler";
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
 * The signed-in user's edits to their own artist profile, ten per page.
 *
 * @param request - The request; a Privy token, `page` optional.
 * @returns 200 with `{ status, entries, total, page, pageCount }`, 400, 401 or 500.
 */
export async function GET(request: Request) {
  return getSelfEditsHandler(request);
}

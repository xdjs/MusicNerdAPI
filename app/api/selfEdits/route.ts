import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSelfEditsHandler } from "@/lib/selfEdits/getSelfEditsHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers and no body.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/selfEdits — paginated self-edits for the user.
 *
 * @param request - Authenticated request with optional `?page=`.
 * @returns 200 with `{ status: "ok", entries, total, page, pageCount }`.
 */
export async function GET(request: Request) {
  return getSelfEditsHandler(request);
}

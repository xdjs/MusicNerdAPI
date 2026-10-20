import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserEntriesHandler } from "@/lib/userEntries/getUserEntriesHandler";

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
 * GET /api/userEntries — paginated UGC entries with filters.
 *
 * @param request - Authenticated request with filter query params.
 * @returns 200 with `{ status: "ok", entries, total, pageCount, platforms }`.
 */
export async function GET(request: Request) {
  return getUserEntriesHandler(request);
}

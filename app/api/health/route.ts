import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getHealthHandler } from "@/lib/health/getHealthHandler";

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
 * GET /api/health — confirms the API is up (docs/endpoints/health.md).
 *
 * @returns 200 with `{ status: "ok" }`.
 */
export async function GET() {
  return getHealthHandler();
}

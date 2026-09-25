import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/health: the API is up. Reads
 * nothing, so it is safe to poll.
 *
 * @returns 200 with `{ status: "ok" }`.
 */
export function getHealthHandler(): NextResponse {
  return NextResponse.json({ status: "ok" }, { status: 200, headers: getCorsHeaders() });
}

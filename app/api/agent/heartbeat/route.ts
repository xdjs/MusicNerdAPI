import { NextResponse } from "next/server";
import { postHeartbeatHandler } from "@/lib/agentReports/postHeartbeatHandler";
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
 * Stores an ID-mapping worker's heartbeat, one row per worker.
 *
 * @param request - The request; an MCP API key as `Authorization: Bearer`.
 * @returns 200 `{ success: true }`, or `{ error }` with 400, 401 or 500.
 */
export async function POST(request: Request) {
  return postHeartbeatHandler(request);
}

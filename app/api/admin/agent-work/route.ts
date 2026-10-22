import { NextResponse } from "next/server";
import { getAgentWorkHandler } from "@/lib/agentWork/getAgentWorkHandler";
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
 * The Agent work tab: mapping coverage, activity and workers, or with
 * `sections=details` the audit log, agent breakdown, exclusions and runs.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the summary or details, or an error.
 */
export async function GET(request: Request) {
  return getAgentWorkHandler(request);
}

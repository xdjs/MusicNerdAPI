import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchAdvanceHandler } from "@/lib/research/getResearchAdvanceHandler";
import { postResearchAdvanceHandler } from "@/lib/research/postResearchAdvanceHandler";

export const dynamic = "force-dynamic";
/** A slice gets the whole allowance, the reason this route exists. 60 is the ceiling on the current plan. */
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers and no body.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/advance — runs one slice of queued research, optionally
 * for one artist (`{ "artistId": "<uuid>" }`). Safe to call concurrently: jobs
 * are claimed atomically under a lease.
 *
 * @param request - The request.
 * @returns 200 with `{ status, ran, jobId?, kind?, artistId?, progress?, done?, waiting? }`.
 */
export async function POST(request: Request) {
  return postResearchAdvanceHandler(request);
}

/**
 * GET /api/research/advance — the scheduler: takes slices until the budget
 * runs out. Requires `Authorization: Bearer $CRON_SECRET` when it is set.
 *
 * @param request - The request.
 * @returns 200 with `{ status, ran, slices }`, or 401.
 */
export async function GET(request: Request) {
  return getResearchAdvanceHandler(request);
}

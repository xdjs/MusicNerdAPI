import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionProgressHandler } from "@/lib/questionResearch/getQuestionProgressHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Reports a public question's research progress, first running one bounded
 * slice of question research while the job is not terminal. Public.
 *
 * @param request - The request.
 * @param context - Route context.
 * @param context.params - The artist and research job IDs.
 * @returns 200 with `{ status, jobId, stage, provider, message, retryAfterMs }`, 400 or 503.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  return getQuestionProgressHandler(request, id, jobId);
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleInterviewSessionRequest } from "@/lib/interviewSessions/handleInterviewSessionRequest";
export const dynamic = "force-dynamic";
/**
 * CORS preflight.
 *
 * @returns Allowed request headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
/**
 * POST artist interview answer; authorized persistence only, no model or provider calls.
 *
 * @param request - Private authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and interview identity.
 * @returns Exact saved state or a safe failure.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; answerId: string }> },
) {
  const params = await context.params;
  return handleInterviewSessionRequest(request, params.id, "answer", params.answerId);
}

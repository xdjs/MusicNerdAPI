import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleInterviewPreparation } from "@/lib/interviewPreparation/handleInterviewPreparation";
export const dynamic = "force-dynamic";
/**
 * CORS preflight for private interview preparation.
 *
 * @returns Allowed headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
/**
 * Read durable preparation status without paid work or writes.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and session identifiers.
 * @returns Safe status only.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> },
) {
  const p = await context.params;
  return handleInterviewPreparation(request, p.id, p.sessionId);
}
/**
 * Explicitly enqueue preparation or consume a current checked candidate.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and session identifiers.
 * @returns Preparation state or the saved offer.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> },
) {
  const p = await context.params;
  return handleInterviewPreparation(request, p.id, p.sessionId);
}

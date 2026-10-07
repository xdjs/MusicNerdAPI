import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleInterviewResponse } from "@/lib/interviewResponses/handleInterviewResponse";

export const dynamic = "force-dynamic";

/** CORS preflight for authenticated clients.
 * @returns The allowed methods and headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/** Read saved interview responses for the current claimant or administrator.
 * @param request - Authenticated incoming request.
 * @param context - Route context.
 * @param context.params - Artist and response identity.
 * @returns Exact response data or a private typed error.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await context.params;
  return handleInterviewResponse(request, id, "read", answerId);
}

/** Revise saved interview responses for the current claimant or administrator.
 * @param request - Authenticated incoming request.
 * @param context - Route context.
 * @param context.params - Artist and response identity.
 * @returns Exact response data or a private typed error.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; answerId: string }> },
) {
  const { id, answerId } = await context.params;
  return handleInterviewResponse(request, id, "revise", answerId);
}

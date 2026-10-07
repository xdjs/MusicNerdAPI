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

/** List saved interview responses for the current claimant or administrator.
 * @param request - Authenticated incoming request.
 * @param context - Route context.
 * @param context.params - Artist and response identity.
 * @returns Exact response data or a private typed error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleInterviewResponse(request, id, "list");
}

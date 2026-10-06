import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postInterviewBoundaryHandler } from "@/lib/interviewMemory/postInterviewBoundaryHandler";
export const dynamic = "force-dynamic";
/**
 * CORS preflight.
 *
 * @returns The allowed request headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
/**
 * POST /api/artist/{id}/interview/boundaries — private artist memory.
 *
 * @param request - The authenticated request.
 * @param context - Artist and optional boundary route parameters.
 * @param context.params - The artist and boundary identity.
 * @returns Exact memory or a safe explicit failure.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postInterviewBoundaryHandler(request, id);
}

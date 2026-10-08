import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postInterviewBoundaryHandler } from "@/lib/interviewMemory/postInterviewBoundaryHandler";
import { getInterviewBoundariesHandler } from "@/lib/interviewMemory/getInterviewBoundariesHandler";
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
 * GET /api/artist/{id}/interview/boundaries — paginated active instruction management.
 *
 * @param request - The authenticated request with sitting and optional cursor.
 * @param context - Artist route parameters.
 * @param context.params - The artist identity.
 * @returns A private bounded page of exact instructions, or an explicit failure.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getInterviewBoundariesHandler(request, id);
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

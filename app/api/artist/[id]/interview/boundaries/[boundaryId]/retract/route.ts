import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postBoundaryRetractionHandler } from "@/lib/interviewMemory/postBoundaryRetractionHandler";
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
 * POST /api/artist/{id}/interview/boundaries/{boundaryId}/retract — private artist memory.
 *
 * @param request - The authenticated request.
 * @param context - Artist and optional boundary route parameters.
 * @param context.params - The artist and boundary identity.
 * @returns Exact memory or a safe explicit failure.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; boundaryId: string }> },
) {
  const { id, boundaryId } = await context.params;
  return postBoundaryRetractionHandler(request, id, boundaryId);
}

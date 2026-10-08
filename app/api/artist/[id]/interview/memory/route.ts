import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getInterviewMemoryHandler } from "@/lib/interviewMemory/getInterviewMemoryHandler";
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
 * GET /api/artist/{id}/interview/memory — private artist memory.
 *
 * @param request - The authenticated request.
 * @param context - Artist and optional boundary route parameters.
 * @param context.params - The artist and boundary identity.
 * @returns Exact memory or a safe explicit failure.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getInterviewMemoryHandler(request, id);
}

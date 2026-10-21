import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionSourceHandler } from "@/lib/questionResearch/getQuestionSourceHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Reads a window of an original cited by an answer, under research's current
 * eligibility checks. Public.
 *
 * @param request - `?sourceId&revision&start`.
 * @param context - Route context.
 * @param context.params - The artist ID.
 * @returns 200 with `{ status, passage, totalChars, nextStart }`, 400 or 409.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getQuestionSourceHandler(request, id);
}

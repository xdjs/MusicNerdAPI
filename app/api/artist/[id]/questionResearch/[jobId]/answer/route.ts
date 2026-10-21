import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postQuestionAnswerHandler } from "@/lib/questionResearch/postQuestionAnswerHandler";

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
 * Drafts and checks the answer to a question already registered on a research
 * job once the job is terminal; never plans or starts new research. Public.
 *
 * @param request - `{ question }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id` and the research `jobId`.
 * @returns 200 with the answer, 202 while the job or answer is still in progress, or an error.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  return postQuestionAnswerHandler(request, id, jobId);
}

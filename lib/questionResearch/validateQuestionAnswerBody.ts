import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { questionRequestSchema } from "@/lib/questionResearch/questionRequestSchema";

/** The answer route's body is the question alone; the URL names the artist and job. */
export async function validateQuestionAnswerBody(
  request: Request,
): Promise<{ question: string } | NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const invalid = () =>
    NextResponse.json({ status: "error", error: "Invalid question" }, { status: 400, headers });
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 18000) throw new Error("Oversized request");
    body = JSON.parse(raw);
  } catch {
    return invalid();
  }
  const question = questionRequestSchema.pick({ question: true }).safeParse(body);
  return question.success ? question.data : invalid();
}

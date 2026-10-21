import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postAskArtistHandler } from "@/lib/questionResearch/postAskArtistHandler";
import { validateQuestionAnswerBody } from "@/lib/questionResearch/validateQuestionAnswerBody";

/** Collect only an existing public job's registered answer; never start new research. */
export async function postQuestionAnswerHandler(request: Request, id: string, jobId: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const params = z
      .object({ id: z.string().uuid(), jobId: z.string().uuid() })
      .safeParse({ id, jobId });
    if (!params.success)
      return NextResponse.json(
        { status: "error", error: "Invalid research job" },
        { status: 400, headers },
      );
    const question = await validateQuestionAnswerBody(request);
    if (question instanceof NextResponse) return question;
    // URL scope is authoritative. The shared handler skips planning/registration
    // for jobId and enforces the saved artist/job/question and drafting lease.
    return await postAskArtistHandler(
      new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: params.data.id,
          jobId: params.data.jobId,
          question: question.question,
        }),
        signal: request.signal,
      }),
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Research is temporarily unavailable. Please try again." },
      { status: 503, headers },
    );
  }
}

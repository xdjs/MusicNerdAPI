import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionResearchStatus } from "@/lib/questionResearch/getQuestionResearchStatus";
import { researchStatusSchema } from "@/lib/questionResearch/publicQuestionSchemas";
import { advanceResearch } from "@/lib/research/advanceResearch";
import { ADVANCE_MAX_DURATION_S, RESPONSE_RESERVE_MS } from "@/lib/research/const";

/** Resume existing bounded work, then return actual progress without exposing job scratch (MusicNerdWeb's `GET /api/artist/[id]/questionResearch/[jobId]`, calling the research library in process as the public service instead of over HTTP). */
export async function getQuestionProgressHandler(request: Request, id: string, jobId: string) {
  const started = Date.now();
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const params = z.object({ id: z.uuid(), jobId: z.uuid() }).safeParse({ id, jobId });
    if (!params.success)
      return NextResponse.json(
        { status: "error", error: "Invalid research job" },
        { status: 400, headers },
      );
    const read = async () =>
      researchStatusSchema.parse(await getQuestionResearchStatus(id, jobId, { kind: "service" }));
    let state = await read();
    if (!["complete", "unresolved", "failed", "cancelled"].includes(state.stage)) {
      // Web's advance route answered 200 `ran: false` on failure, so the proxy re-read either way.
      await advanceResearch({
        budgetMs: ADVANCE_MAX_DURATION_S * 1000 - RESPONSE_RESERVE_MS - (Date.now() - started),
        artistId: id,
        kinds: ["question_research"],
      }).catch(error => console.error("[questionResearch/progress] advance failed:", error));
      state = await read();
    }
    return NextResponse.json(
      {
        status: "ok",
        jobId: state.jobId,
        stage: state.stage,
        provider: state.provider,
        message: state.message,
        retryAfterMs: 5000,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Research could not be checked. The saved job can be resumed." },
      { status: 503, headers },
    );
  }
}

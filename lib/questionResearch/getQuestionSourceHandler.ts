import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { researchReadSchema } from "@/lib/questionResearch/publicQuestionSchemas";
import { readResearchOriginal } from "@/lib/questionResearch/readResearchOriginal";
import { validateQuestionSourceQuery } from "@/lib/questionResearch/validateQuestionSourceQuery";

/** Read a current public citation through the same access/revision boundary as research (MusicNerdWeb's `GET /api/artist/[id]/questionResearch/source`, reading in process as the public research service instead of over HTTP). */
export async function getQuestionSourceHandler(request: Request, artistId: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const query = validateQuestionSourceQuery(request, artistId);
    if (query instanceof NextResponse) return query;
    const body = researchReadSchema.parse(
      await readResearchOriginal(
        artistId,
        { kind: "service" },
        query.sourceId,
        query.revision,
        query.start,
        12000,
      ),
    );
    return NextResponse.json(body, { headers });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: "This original changed or is no longer available. Refresh the research.",
      },
      { status: 409, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { referenceSchema } from "@/lib/questionResearch/publicQuestionSchemas";

const querySchema = z
  .object({
    sourceId: referenceSchema.shape.sourceId,
    revision: referenceSchema.shape.revision,
    start: z.coerce.number().int().min(0).max(4000000).default(0),
  })
  .strict();

/** Read a cited-source query the way Web's `questionResearch/source` proxy did: a UUID artist and exactly `sourceId`, `revision` and an optional `start`, else 400. */
export function validateQuestionSourceQuery(
  request: Request,
  artistId: string,
): z.infer<typeof querySchema> | NextResponse {
  const q = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!z.uuid().safeParse(artistId).success || !q.success)
    return NextResponse.json(
      { status: "error", error: "Invalid source reference" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  return q.data;
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { artistKnowledgeIdSchema, knowledgeInputSchemas } from "@/lib/knowledge/knowledgeSchemas";
import type { KnowledgeQuery, Operation } from "@/lib/knowledge/types";

/** Validates strict HTTP inputs before authentication/storage work. */
export function validateArtistKnowledgeQuery(
  request: Request,
  artistId: string,
  operation: Operation,
  sourceId?: string,
): KnowledgeQuery | NextResponse {
  const invalid = () =>
    NextResponse.json(
      { status: "error", error: "Invalid knowledge request", code: "invalid_input" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  if (!artistKnowledgeIdSchema.safeParse(artistId).success) return invalid();
  const input: Record<string, unknown> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(input, key) || key === "sourceId") return invalid();
    if (["limit", "maxChars", "start", "sitting"].includes(key)) {
      if (!/^\d+$/.test(value)) return invalid();
      input[key] = Number(value);
    } else input[key] = value;
  }
  if (operation === "read") input.sourceId = sourceId;
  const result = knowledgeInputSchemas[operation].safeParse(input);
  return result.success ? ({ ...result.data, operation } as KnowledgeQuery) : invalid();
}

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { validateArtistKnowledgeQuery } from "@/lib/knowledge/validateArtistKnowledgeQuery";
import type { Operation } from "@/lib/knowledge/types";

/** Shared authenticated read path; outages never appear as empty knowledge. */
export async function getArtistKnowledgeHandler(
  request: Request,
  artistId: string,
  operation: Operation,
  sourceId?: string,
) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const input = validateArtistKnowledgeQuery(request, artistId, operation, sourceId);
  if (input instanceof NextResponse) return input;
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      throw new KnowledgeError("unauthenticated", 401, "Not signed in");
    const snapshot = await loadArtistKnowledge(artistId, auth.userId);
    return NextResponse.json(queryArtistKnowledge(snapshot, input), { headers });
  } catch (error) {
    const failure =
      error instanceof KnowledgeError
        ? error
        : new KnowledgeError(
            "storage_unavailable",
            503,
            "Artist knowledge is temporarily unavailable",
          );
    return NextResponse.json(
      { status: "error", error: failure.message, code: failure.code },
      { status: failure.status, headers },
    );
  }
}

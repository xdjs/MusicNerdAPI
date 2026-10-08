import { z } from "zod";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { authenticateResearchRequest } from "@/lib/questionResearch/authenticateResearchRequest";
import type { ResearchAuth } from "@/lib/questionResearch/types";
/** Shared UUID/auth/error boundary; service credentials never authorize private operations. */
export async function withResearchRequest(
  request: Request,
  artistId: string,
  privateOperation: boolean,
  operation: (auth: ResearchAuth) => Promise<unknown>,
  successStatus = 200,
) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    if (!z.uuid().safeParse(artistId).success)
      throw new KnowledgeError("invalid_request", 400, "artistId must be a UUID");
    const auth = await authenticateResearchRequest(request, artistId, privateOperation);
    if (auth instanceof NextResponse)
      throw new KnowledgeError("unauthenticated", auth.status, "Not signed in");
    return NextResponse.json(await operation(auth), { status: successStatus, headers });
  } catch (error) {
    const e =
      error instanceof KnowledgeError
        ? error
        : new KnowledgeError("research_unavailable", 503, "Research is temporarily unavailable");
    return NextResponse.json(
      { status: "error", error: e.message, code: e.code },
      {
        status: e.status,
        headers: { ...headers, ...(e.status === 429 ? { "Retry-After": "60" } : {}) },
      },
    );
  }
}

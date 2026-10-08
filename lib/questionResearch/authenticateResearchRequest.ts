import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { ResearchAuth } from "@/lib/questionResearch/types";
/** Separate a server-only public research grant from the current artist's private access. */
export async function authenticateResearchRequest(
  request: Request,
  artistId: string,
  privateOperation = false,
): Promise<ResearchAuth | NextResponse> {
  const supplied = request.headers.get("X-MusicNerd-Research-Key");
  if (supplied !== null) {
    const expected = process.env.MUSICNERD_RESEARCH_API_KEY;
    if (!expected || expected.length < 32)
      throw new KnowledgeError("research_disabled", 503, "Public research is unavailable");
    const a = Buffer.from(supplied),
      b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new KnowledgeError("unauthenticated", 401, "Invalid research credential");
    if (privateOperation)
      throw new KnowledgeError("forbidden", 403, "Artist claimant or administrator required");
    return { kind: "service" };
  }
  const auth = await validateArtistEditRequest(request, artistId);
  return auth instanceof NextResponse ? auth : { kind: "artist", userId: auth.userId };
}

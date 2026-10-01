import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { advanceResearch } from "@/lib/research/advanceResearch";
import { ADVANCE_MAX_DURATION_S, RESPONSE_RESERVE_MS } from "@/lib/research/const";
import type { JobKind } from "@/lib/research/types";
import { validateAdvanceResearchBody } from "@/lib/research/validateAdvanceResearchBody";

/**
 * Handles POST /api/research/advance: one slice of research, with the
 * route's whole allowance rather than a chat turn's leftovers. Called by the
 * onboarding page while the artist watches, and by "look again".
 *
 * @param request - The request, optionally naming an artist.
 * @returns 200 with the slice's result. Errors are 200 with `ran: false`, deliberately: callers are a browser poll and a scheduler, and a 500 teaches them to back off from work that is fine.
 */
export async function postResearchAdvanceHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const body = await validateAdvanceResearchBody(request);
  if (body instanceof NextResponse) return body;
  const started = Date.now();
  try {
    const result = await advanceResearch({
      budgetMs: ADVANCE_MAX_DURATION_S * 1000 - RESPONSE_RESERVE_MS,
      artistId: body.artistId,
      ...(body.kinds ? { kinds: body.kinds as JobKind[] } : {}),
    });
    console.debug(`[research/advance] ${JSON.stringify(result)} in ${Date.now() - started}ms`);
    return NextResponse.json({ status: "ok", ...result }, { headers });
  } catch (e) {
    console.error("[research/advance] Error:", e);
    return NextResponse.json({ status: "error", error: "advance failed", ran: false }, { headers });
  }
}

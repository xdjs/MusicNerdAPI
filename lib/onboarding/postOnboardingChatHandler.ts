import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runOnboardingTurn } from "@/lib/onboarding/runOnboardingTurn";
import { streamTurnEvents } from "@/lib/onboarding/streamTurnEvents";
import { validateOnboardingTurnBody } from "@/lib/onboarding/validateOnboardingTurnBody";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * `POST /api/onboarding/{artistId}/chat`: one chat turn, streamed as
 * server-sent events. The claimant (or an admin), signed in with a Privy
 * access token. Every write in the turn re-checks the claim read here.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>` and the turn.
 * @param id - The artist id from the path.
 * @returns The event stream, or a 400, 401 or 403 with `{ status: "error", error }`.
 */
export async function postOnboardingChatHandler(request: Request, id: string): Promise<Response> {
  const startedAt = Date.now();
  const validated = await validateArtistEditRequest(request, id);
  if (validated instanceof NextResponse) return validated;
  const { artistId, userId } = validated;
  const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
  const turn = await validateOnboardingTurnBody(request);
  if (turn instanceof NextResponse) return turn;
  const events = runOnboardingTurn(artistId, turn, { userId, expectedClaimId });
  return new Response(streamTurnEvents(events, startedAt), {
    headers: {
      ...getCorsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

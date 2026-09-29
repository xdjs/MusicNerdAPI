import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runOnboardingTurn } from "@/lib/onboarding/runOnboardingTurn";
import { streamTurnEvents } from "@/lib/onboarding/streamTurnEvents";
import { validateOnboardingTurnBody } from "@/lib/onboarding/validateOnboardingTurnBody";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { validateArtistId } from "@/lib/research/validateArtistId";

/**
 * `POST /api/onboarding/{artistId}/chat`: one chat turn, streamed as
 * server-sent events. The claimant (or an admin), signed in with a Privy
 * access token. The claim is read before the edit check, as in MusicNerdWeb,
 * and every write in the turn re-checks it.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>` and the turn.
 * @param id - The artist id from the path.
 * @returns The event stream, or a 400, 401 or 403 with `{ status: "error", error }`.
 */
export async function postOnboardingChatHandler(request: Request, id: string): Promise<Response> {
  const startedAt = Date.now();
  const artistId = validateArtistId(id);
  if (artistId instanceof NextResponse) return artistId;
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
  if (!(await canEditArtist(auth.userId, artistId))) {
    return NextResponse.json(
      { status: "error", error: "Not authorized" },
      { status: 403, headers: getCorsHeaders() },
    );
  }
  const turn = await validateOnboardingTurnBody(request);
  if (turn instanceof NextResponse) return turn;
  const events = runOnboardingTurn(artistId, turn, { userId: auth.userId, expectedClaimId });
  return new Response(streamTurnEvents(events, startedAt), {
    headers: {
      ...getCorsHeaders(),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { getLatestRefresh } from "@/lib/latest/getLatestRefresh";
import { requestLatestRefresh } from "@/lib/latest/requestLatestRefresh";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * MusicNerdWeb's Update Latest route: GET reads the artist's Latest request in
 * scope; POST queues one first, as the requester under the current claim. The
 * claimant or an admin, by Privy token.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param artistId - The artist id from the path.
 * @param write - True for POST: queue the request before reading it.
 * @returns 200 `{ status, refresh }`, or 400/401/403/503 `{ status: "error", error }`.
 */
export async function handleLatestRefresh(request: Request, artistId: string, write: boolean) {
  const headers = getCorsHeaders();
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artistId))
    return fail("Invalid artist", 400);
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return fail("Sign in to update Latest.", 401);
    if (!(await canEditArtist(auth.userId, artistId)))
      return fail("Only this artist or an admin can update Latest.", 403);
    if (write) {
      // Capture before reading sources; a replacement claim is a new generation.
      const claimId = (await findApprovedClaim(db, artistId))?.id ?? null;
      await withArtistOperation(
        artistId,
        { userId: auth.userId, expectedClaimId: claimId, trigger: "manual_latest_refresh" },
        () => requestLatestRefresh(artistId),
      );
    }
    return NextResponse.json(
      { status: "ok", refresh: await getLatestRefresh(artistId) },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const changed = error instanceof OwnershipChangedError;
    return fail(
      changed
        ? "Your access changed. Reload the profile."
        : "Latest could not be checked. Please try again.",
      changed ? 403 : 503,
    );
  }
}

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { ARTIST_ID_PATTERN } from "@/lib/artists/const";
import { db } from "@/lib/db/db";
import { validateLoreSuggestionBody } from "@/lib/loreSuggestions/validateLoreSuggestionBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { getVaultSourceUrlsByArtistId } from "@/lib/vault/getVaultSourceUrlsByArtistId";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";

/**
 * Handles POST /api/artist/{id}/lore-suggestions: any signed-in account
 * suggests a web page as a Lore source. An admin's or whitelisted contributor's
 * source is approved at once and queues a Lore refresh; anyone else's waits
 * for review. Trust is read from the account at write time, never the request.
 *
 * @param request - The request; a Privy token and `{ url }`.
 * @param artistId - The artist id from the path.
 * @returns 201 with `{ status, success, sourceStatus, warning? }`; 400, 401, 409 or 500.
 */
export async function postLoreSuggestionHandler(request: Request, artistId: string) {
  const headers = getCorsHeaders();
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (!ARTIST_ID_PATTERN.test(artistId)) return fail("Invalid artist ID", 400);
    const input = validateLoreSuggestionBody(await request.json().catch(() => null));
    if (input instanceof NextResponse) return input;
    const { url } = input;
    // Older editor submissions could keep fragments: compare canonical forms
    // before relying on the raw-URL unique index.
    const existing = await getVaultSourceUrlsByArtistId(artistId);
    if (existing.some(sourceUrl => canonicalizeLoreUrl(sourceUrl) === url))
      return fail("This source has already been suggested", 409);
    const claimId = (await findApprovedClaim(db, artistId))?.id ?? null;
    const title = `Source from ${new URL(url).hostname.replace(/^www\./, "")}`;
    const source = await insertVaultSource(
      { artistId, url, title, type: inferTypeFromUrl(url), status: "pending" },
      { userId: auth.userId, trigger: "visitor_suggestion", approveIfTrusted: true },
    );
    if (!source) return fail("This source has already been suggested", 409);
    let warning: string | undefined;
    if (source.status === "approved") {
      try {
        await queueLoreRefresh(artistId, claimId, {
          userId: auth.userId,
          trigger: "source_submission",
        });
      } catch (error) {
        console.error("[lore-suggestions] Source saved; Lore enqueue failed", error);
        warning =
          "Source saved and approved, but the Lore refresh could not start. An artist or admin can retry it. You do not need to submit again.";
      }
    }
    return NextResponse.json(
      { status: "ok", success: true, sourceStatus: source.status, warning },
      { status: 201, headers },
    );
  } catch (error) {
    console.error("[lore-suggestions] Could not save source", error);
    return fail("Could not submit the source. Please try again.", 500);
  }
}

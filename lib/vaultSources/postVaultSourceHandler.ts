import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { validateLoreSuggestionBody } from "@/lib/loreSuggestions/validateLoreSuggestionBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { enrichVaultSource } from "@/lib/onboarding/enrichVaultSource";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { getVaultSourceUrlsByArtistId } from "@/lib/vault/getVaultSourceUrlsByArtistId";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";

/**
 * Handles POST /api/artist/{id}/knowledge/sources: the artist's claimant or an
 * admin adds a web page as a source. It is approved at once for an admin or a
 * whitelisted contributor, which queues a Lore refresh; otherwise it waits for review.
 *
 * @param request - The request; a claimant or admin Privy token and `{ url }`.
 * @param id - The artist id from the path.
 * @returns 201 with `{ status, source, warning? }`; 400, 401, 403, 409 or 500.
 */
export async function postVaultSourceHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const fail = (status: number, error: string) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const { artistId, userId } = auth;
    const input = validateLoreSuggestionBody(await request.json().catch(() => null));
    if (input instanceof NextResponse) return input;
    const { url } = input;
    const claimId = await getLoreClaimGeneration(artistId);

    const existing = await getVaultSourceUrlsByArtistId(artistId);
    if (existing.some(sourceUrl => canonicalizeLoreUrl(sourceUrl) === url))
      return fail(409, "This source has already been added");

    const preview = await fetchLinkPreview(url);
    const source = await insertVaultSource(
      {
        artistId,
        url,
        title: preview.title ?? `Source from ${new URL(url).hostname.replace(/^www\./, "")}`,
        ogImage: preview.imageUrl,
        type: inferTypeFromUrl(url),
        status: "pending",
      },
      { userId, trigger: "editor_source", approveIfTrusted: true },
      { userId, expectedClaimId: claimId },
    );
    if (!source) return fail(409, "This source has already been added");

    // Podcast episodes need their identity for grouping; nothing else waits.
    await enrichVaultSource(source.id, url, { keepTitle: false });

    let warning: string | undefined;
    if (source.status === "approved") {
      try {
        await queueLoreRefresh(artistId, claimId, { userId, trigger: "source_submission" });
      } catch (error) {
        console.error("[knowledge/sources] Source saved; Lore enqueue failed", error);
        warning =
          "Source saved and approved, but the Lore refresh could not start. Use Look again to retry; do not add the source again.";
      }
    }
    return NextResponse.json({ status: "ok", source, warning }, { status: 201, headers });
  } catch (error) {
    console.error("[knowledge/sources] Could not add source", error);
    if (error instanceof OwnershipChangedError) return fail(403, error.message);
    return fail(500, "Failed to add source");
  }
}

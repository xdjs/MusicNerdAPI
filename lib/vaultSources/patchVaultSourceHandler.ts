import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { updateVaultSourceStatus } from "@/lib/vault/updateVaultSourceStatus";
import { updateVaultSourceType } from "@/lib/vault/updateVaultSourceType";
import { queueSourceChangeRefresh } from "@/lib/vaultSources/queueSourceChangeRefresh";
import { validatePatchVaultSourceBody } from "@/lib/vaultSources/validatePatchVaultSourceBody";
import { validateSourceEditRequest } from "@/lib/vaultSources/validateSourceEditRequest";

/**
 * Handles PATCH /api/artist/{id}/knowledge/sources/{sourceId}: the artist's
 * claimant or an admin changes a source's type, or approves or rejects it. A
 * decision queues a Lore refresh, so Lore follows the sources both ways.
 *
 * @param request - The request; a claimant or admin Privy token and `{ status?, expectedStatus?, type? }`.
 * @param id - The artist id from the path.
 * @param sourceId - The source id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403, 404, 409 or 500.
 */
export async function patchVaultSourceHandler(
  request: Request,
  id: string,
  sourceId: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const fail = (status: number, error: string) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const auth = await validateSourceEditRequest(request, id, sourceId);
    if (auth instanceof NextResponse) return auth;
    const body = validatePatchVaultSourceBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const { artistId, userId, claimId } = auth;

    if (body.status) {
      const { status, expectedStatus } = body;
      const updated = await withArtistOperation(
        artistId,
        { userId, expectedClaimId: claimId, trigger: "source_review" },
        () => updateVaultSourceStatus(auth.sourceId, status, expectedStatus),
      );
      if (expectedStatus && !updated)
        return fail(
          409,
          "This Lore source was already reviewed. Refresh the queue to see its current status.",
        );
      await queueSourceChangeRefresh(artistId, claimId, userId);
    }
    // After the decision, so a 409 changes nothing.
    if (body.type) await updateVaultSourceType(auth.sourceId, body.type);
    return NextResponse.json({ status: "ok" }, { status: 200, headers });
  } catch (error) {
    console.error("[knowledge/sources] Could not update source", error);
    if (error instanceof OwnershipChangedError) return fail(403, error.message);
    return fail(500, "Failed to update source");
  }
}

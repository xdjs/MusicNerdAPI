import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { deleteVaultSources } from "@/lib/vault/deleteVaultSources";
import { queueSourceChangeRefresh } from "@/lib/vaultSources/queueSourceChangeRefresh";
import { validateDeleteVaultSourcesBody } from "@/lib/vaultSources/validateDeleteVaultSourcesBody";

/**
 * Handles DELETE /api/artist/{id}/knowledge/sources: the artist's claimant or
 * an admin deletes several sources at once, all or nothing, and a Lore refresh
 * is queued.
 *
 * @param request - The request; a claimant or admin Privy token and `{ sourceIds }`.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, count }`; 400, 401, 403, 404 or 500.
 */
export async function deleteVaultSourcesHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const body = validateDeleteVaultSourcesBody(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const claimId = await getLoreClaimGeneration(auth.artistId);
    const deleted = await deleteVaultSources(auth.artistId, body.sourceIds);
    if (!deleted)
      return NextResponse.json(
        { status: "error", error: "One or more sources not found" },
        { status: 404, headers },
      );
    await queueSourceChangeRefresh(auth.artistId, claimId, auth.userId);
    return NextResponse.json({ status: "ok", count: deleted.length }, { status: 200, headers });
  } catch (error) {
    console.error("[knowledge/sources] Could not delete sources", error);
    return NextResponse.json(
      { status: "error", error: "Failed to delete sources" },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteVaultSources } from "@/lib/vault/deleteVaultSources";
import { queueSourceChangeRefresh } from "@/lib/vaultSources/queueSourceChangeRefresh";
import { validateSourceEditRequest } from "@/lib/vaultSources/validateSourceEditRequest";

/**
 * Handles DELETE /api/artist/{id}/knowledge/sources/{sourceId}: the artist's
 * claimant or an admin deletes a source, which queues a Lore refresh.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @param sourceId - The source id from the path.
 * @returns 200 with `{ status: "ok" }`; 400, 401, 403, 404 or 500.
 */
export async function deleteVaultSourceHandler(
  request: Request,
  id: string,
  sourceId: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await validateSourceEditRequest(request, id, sourceId);
    if (auth instanceof NextResponse) return auth;
    if (!(await deleteVaultSources(auth.artistId, [auth.sourceId])))
      return NextResponse.json(
        { status: "error", error: "Source not found" },
        { status: 404, headers },
      );
    await queueSourceChangeRefresh(auth.artistId, auth.claimId, auth.userId);
    return NextResponse.json({ status: "ok" }, { status: 200, headers });
  } catch (error) {
    console.error("[knowledge/sources] Could not delete source", error);
    return NextResponse.json(
      { status: "error", error: "Failed to delete source" },
      { status: 500, headers },
    );
  }
}

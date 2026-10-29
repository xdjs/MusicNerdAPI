import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getLoreClaimGeneration } from "@/lib/ownership/getLoreClaimGeneration";
import { getVaultSourceByIdAndArtist } from "@/lib/vault/getVaultSourceByIdAndArtist";

const sourceIdSchema = z.uuid({ error: "sourceId must be a UUID" });

/**
 * Validates a signed-in request to change one of an artist's sources: the
 * caller is the artist's approved claimant or an admin, and the source belongs
 * to the artist. Captures the claim generation the change runs under.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param id - The artist id from the path.
 * @param sourceId - The source id from the path.
 * @returns `{ artistId, userId, sourceId, claimId }`, or a 400, 401, 403 or 404 response.
 */
export async function validateSourceEditRequest(
  request: Request,
  id: string,
  sourceId: string,
): Promise<
  { artistId: string; userId: string; sourceId: string; claimId: string | null } | NextResponse
> {
  const headers = getCorsHeaders();
  const auth = await validateArtistEditRequest(request, id);
  if (auth instanceof NextResponse) return auth;
  const parsed = sourceIdSchema.safeParse(sourceId);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: parsed.error.issues[0].message },
      { status: 400, headers },
    );
  const claimId = await getLoreClaimGeneration(auth.artistId);
  if (!(await getVaultSourceByIdAndArtist(parsed.data, auth.artistId)))
    return NextResponse.json(
      { status: "error", error: "Source not found" },
      { status: 404, headers },
    );
  return { ...auth, sourceId: parsed.data, claimId };
}

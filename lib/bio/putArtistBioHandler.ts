import { NextResponse } from "next/server";
import { z } from "zod";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { updateArtistBio } from "@/lib/bio/updateArtistBio";
import { validateArtistBioBody } from "@/lib/bio/validateArtistBioBody";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * Handles PUT /api/artistBio/{id}: the claimant or an admin saves the About
 * they wrote, or regenerates it from the Lore document. The write is fenced
 * on the claim read before authorization.
 *
 * @param request - The request; a claimant or admin Privy token and `{ bio }` or `{ regenerate: true }`.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, message, bio? }`; 400, 401, 403, 404, 408, 409 or 500 with `{ status, error, code? }`.
 */
export async function putArtistBioHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    if (!z.uuid().safeParse(id).success)
      return NextResponse.json(
        { status: "error", error: "artistId must be a UUID" },
        { status: 400, headers },
      );
    const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const input = validateArtistBioBody(await request.json().catch(() => null));
    if (input instanceof NextResponse) return input;
    const result = await updateArtistBio(id, input, { userId: auth.userId, expectedClaimId });
    if (result.status === "success")
      return NextResponse.json(
        { status: "ok", message: result.message, bio: result.data },
        { headers },
      );
    return NextResponse.json(
      { status: "error", error: result.message, ...(result.code ? { code: result.code } : {}) },
      { status: result.statusCode ?? 500, headers },
    );
  } catch (e) {
    console.error("[artistBio] PUT error", e);
    return NextResponse.json(
      { status: "error", error: "Error updating bio" },
      { status: 500, headers },
    );
  }
}

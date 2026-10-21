import { NextResponse } from "next/server";
import { z } from "zod";
import { getArtistById } from "@/lib/artists/getArtistById";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { generateArtistBio } from "@/lib/bio/generateArtistBio";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { isRealBio } from "@/lib/bio/isRealBio";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * Handles GET /api/artistBio/{id}. A read returns the About the profile shows:
 * the saved bio for a claimed artist, else the directory's current prepared
 * About, else the claim prompt. `?regenerate=true` is the claimant's or an
 * admin's request to rewrite the About from the stored Lore and save it.
 *
 * @param request - The request; a Privy token when regenerating.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, bio, publicAbout }`, or the regenerated bio; 400, 401, 403, 404, 408, 409 or 500.
 */
export async function getArtistBioHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    if (!z.uuid().safeParse(id).success)
      return NextResponse.json(
        { status: "error", error: "artistId must be a UUID" },
        { status: 400, headers },
      );
    if (new URL(request.url).searchParams.get("regenerate") === "true") {
      // The claim is read before authorization, so a claim change during generation is caught.
      const expectedClaimId = (await findApprovedClaim(db, id))?.id ?? null;
      const auth = await validateArtistEditRequest(request, id);
      if (auth instanceof NextResponse) return auth;
      const { httpStatus, ...result } = await generateArtistBio(id, {
        userId: auth.userId,
        expectedClaimId,
      });
      return NextResponse.json(
        { status: httpStatus === 200 ? "ok" : "error", ...result },
        { status: httpStatus, headers },
      );
    }
    const artist = await getArtistById(id);
    if (!artist)
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    const claimed = (await findApprovedClaim(db, id))?.id ?? null;
    const directoryAbout = claimed ? null : await getPublicArtistAbout(id);
    return NextResponse.json(
      {
        status: "ok",
        bio:
          claimed && isRealBio(artist.bio)
            ? artist.bio
            : (directoryAbout?.bio ?? ABOUT_EMPTY_STATE),
        publicAbout: directoryAbout,
      },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[About] Read failed", error);
    return NextResponse.json(
      { status: "error", error: "Unable to read About. Please try again." },
      { status: 500, headers },
    );
  }
}

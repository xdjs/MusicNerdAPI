import { NextResponse } from "next/server";
import { ARTIST_ID_PATTERN } from "@/lib/artists/const";
import { getArtistById } from "@/lib/artists/getArtistById";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { isRealBio } from "@/lib/bio/isRealBio";
import { sanitizeBioText } from "@/lib/bio/sanitizeBioText";
import { BIO_CORRECTION_MAX_BODY, BIO_CORRECTION_REPORT_LIMIT } from "@/lib/bioCorrections/const";
import { submitBioCorrection } from "@/lib/bioCorrections/submitBioCorrection";
import { validateBioCorrectionBody } from "@/lib/bioCorrections/validateBioCorrectionBody";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * Handles POST /api/artist/{id}/bio-corrections: any signed-in account files a
 * report on the About it read. A report on an About that has since changed is
 * refused, so a report always concerns the text an admin will see.
 *
 * @param request - The request; a Privy token and the report.
 * @param id - The artist id from the path.
 * @returns 201 filed or 200 duplicate with `{ status, success, duplicate }`; 400, 401, 404, 409, 413, 429 or 500.
 */
export async function postBioCorrectionHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (!ARTIST_ID_PATTERN.test(id)) return fail("Invalid artist ID", 400);
    const raw = await request.text();
    if (raw.length > BIO_CORRECTION_MAX_BODY) return fail("Report is too long", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Invalid report", 400);
    }
    const input = validateBioCorrectionBody(body);
    if (input instanceof NextResponse) return input;
    const artist = await getArtistById(id);
    if (!artist) return fail("Artist not found", 404);
    const claimed = (await findApprovedClaim(db, id))?.id ?? null;
    const bio = sanitizeBioText(claimed ? artist.bio : (await getPublicArtistAbout(id))?.bio);
    if (!bio || !isRealBio(bio) || bio !== input.expectedBio)
      return fail(
        "This About has changed. Reload the profile before sending your suggestion.",
        409,
      );
    const result = await submitBioCorrection(auth.userId, id, input, bio);
    if (result === "limited")
      return fail(
        `You have sent ${BIO_CORRECTION_REPORT_LIMIT} reports in the past 24 hours. Please try again when an earlier report is more than 24 hours old.`,
        429,
      );
    return NextResponse.json(
      { status: "ok", success: true, duplicate: result === "duplicate" },
      { status: result === "created" ? 201 : 200, headers },
    );
  } catch {
    return fail("Could not save your suggestion. Please try again.", 500);
  }
}

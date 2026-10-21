import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { getCorrectionAbout } from "@/lib/bioCorrections/getCorrectionAbout";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/bio-corrections/{id}/about: the published About and
 * its revision, never cached.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The report id from the path.
 * @returns 200 with `{ status, bio, revision }`; 400, 401, 403, 409 or 500 with `{ status: "error", error }`.
 */
export async function getCorrectionAboutHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const reportId = validateReportId(id);
  if (reportId instanceof NextResponse) return reportId;
  try {
    const { bio, revision } = await getCorrectionAbout(reportId);
    return NextResponse.json({ status: "ok", bio, revision }, { status: 200, headers });
  } catch (error) {
    const conflict = error instanceof CorrectionAboutConflict;
    if (!conflict) console.error("[bio-corrections] about GET error", error);
    return NextResponse.json(
      {
        status: "error",
        error: conflict ? error.message : "Could not load the current About. Try again.",
      },
      { status: conflict ? 409 : 500, headers },
    );
  }
}

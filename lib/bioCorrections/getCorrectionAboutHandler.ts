import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { getCorrectionAbout } from "@/lib/bioCorrections/getCorrectionAbout";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/bio-corrections/{id}/about: the About a report is
 * about, and the revision an edit must be saved against.
 *
 * @param request - The incoming request.
 * @param id - The report id from the path.
 * @returns 200 with `{ status, bio, revision }`, 400, 401/403, 409 when it can't be edited, or 500.
 */
export async function getCorrectionAboutHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const reportId = validateReportId(id);
  if (reportId instanceof NextResponse) return reportId;
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const { bio, revision } = await getCorrectionAbout(reportId);
    return NextResponse.json({ status: "ok", bio, revision }, { headers });
  } catch (error) {
    const conflict = error instanceof CorrectionAboutConflict;
    if (!conflict) console.error("[bio-corrections/about] GET error", error);
    return NextResponse.json(
      {
        status: "error",
        error: conflict ? error.message : "Could not load the current About. Try again.",
      },
      { status: conflict ? 409 : 500, headers },
    );
  }
}

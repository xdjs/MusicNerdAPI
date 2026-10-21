import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { saveCorrectionAbout } from "@/lib/bioCorrections/saveCorrectionAbout";
import { validateCorrectionAboutBody } from "@/lib/bioCorrections/validateCorrectionAboutBody";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles PUT /api/admin/bio-corrections/{id}/about: saves the About and
 * resolves the report.
 *
 * @param request - The request; an admin's Privy token and `{ bio, revision }`.
 * @param id - The report id from the path.
 * @returns 200 with `{ status, success }`; 400, 401, 403, 409 or 500 with `{ status: "error", error }`.
 */
export async function putCorrectionAboutHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const reportId = validateReportId(id);
    if (reportId instanceof NextResponse) return reportId;
    const body = await validateCorrectionAboutBody(request);
    if (body instanceof NextResponse) return body;
    await saveCorrectionAbout(reportId, auth.userId, body.bio, body.revision);
    return NextResponse.json({ status: "ok", success: true }, { status: 200, headers });
  } catch (error) {
    const conflict = error instanceof CorrectionAboutConflict;
    if (!conflict) console.error("[bio-corrections] about PUT error", error);
    return NextResponse.json(
      {
        status: "error",
        error: conflict
          ? error.message
          : "Could not confirm the save. Your draft is kept; refresh the queue before retrying.",
      },
      { status: conflict ? 409 : 500, headers },
    );
  }
}

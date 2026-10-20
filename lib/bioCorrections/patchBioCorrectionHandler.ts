import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles PATCH /api/admin/bio-corrections/{id}: resolves or dismisses a
 * pending bio-correction report without editing the About.
 *
 * @param request - Body `{ status: "resolved" | "dismissed" }`.
 * @param id - The report id from the path.
 * @returns 200 with `{ status }`, 400, 401/403, or 409 when already reviewed or missing.
 */
export async function patchBioCorrectionHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const reportId = validateReportId(id);
  if (reportId instanceof NextResponse) return reportId;
  const headers = getCorsHeaders();
  const body = await request.json().catch(() => null);
  if (!["resolved", "dismissed"].includes(body?.status))
    return NextResponse.json(
      { status: "error", error: "Invalid review status" },
      { status: 400, headers },
    );
  const updated = await db.execute(sql`update artist_bio_corrections
    set status=${body.status}, reviewed_at=now(), reviewed_by=${auth.userId}::uuid
    where id=${reportId}::uuid and status='pending' returning id`);
  if (!updated.length)
    return NextResponse.json(
      { status: "error", error: "Report was already reviewed or does not exist" },
      { status: 409, headers },
    );
  return NextResponse.json({ status: "ok" }, { headers });
}

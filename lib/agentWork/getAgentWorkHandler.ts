import { NextResponse } from "next/server";
import { getAgentWorkDetails } from "@/lib/agentWork/getAgentWorkDetails";
import { getAgentWorkSummary } from "@/lib/agentWork/getAgentWorkSummary";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/agent-work: the summary by default, or the details
 * with `?sections=details` (paged by `auditPage` and `auditLimit`).
 *
 * @param request - The incoming request.
 * @returns 200 with `{ status, ...summary }` or `{ status, ...details }`, 401/403, or 500.
 */
export async function getAgentWorkHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  const params = new URL(request.url).searchParams;
  try {
    const data =
      params.get("sections") === "details"
        ? await getAgentWorkDetails(
            parseInt(params.get("auditPage") ?? "1", 10) || 1,
            parseInt(params.get("auditLimit") ?? "50", 10) || 50,
          )
        : await getAgentWorkSummary();
    return NextResponse.json({ status: "ok", ...data }, { headers });
  } catch (e) {
    console.error("[agent-work] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

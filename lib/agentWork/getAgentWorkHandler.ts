import { NextResponse } from "next/server";
import { getAgentWorkDetails } from "@/lib/agentWork/getAgentWorkDetails";
import { getAgentWorkSummary } from "@/lib/agentWork/getAgentWorkSummary";
import { validateAgentWorkQuery } from "@/lib/agentWork/validateAgentWorkQuery";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/agent-work: the summary, or with `sections=details`
 * the audit log, agent breakdown, exclusions and run history.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the summary or details and `status: "ok"`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getAgentWorkHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const query = validateAgentWorkQuery(request);
    const data = query.details
      ? await getAgentWorkDetails(query.auditPage, query.auditLimit)
      : await getAgentWorkSummary();
    return NextResponse.json({ status: "ok", ...data }, { status: 200, headers });
  } catch (e) {
    console.error("[agent-work] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

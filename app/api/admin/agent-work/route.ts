import { getAgentWorkHandler } from "@/lib/agentWork/getAgentWorkHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/agent-work — the Agent Work admin tab. Admin only.
 *
 * @param request - Optional `?sections=details&auditPage=&auditLimit=`.
 * @returns The summary, or the details when asked.
 */
export async function GET(request: Request) {
  return getAgentWorkHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

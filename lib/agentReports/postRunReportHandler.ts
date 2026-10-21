import { NextResponse } from "next/server";
import { upsertRun } from "@/lib/agentReports/upsertRun";
import { validateRunReportBody } from "@/lib/agentReports/validateRunReportBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateMcpApiKey } from "@/lib/mcpAuth/validateMcpApiKey";

/**
 * Handles POST /api/agent/run-report: an MCP API key, a validated run report,
 * one upsert. Responses keep the shapes the agent client expects
 * (`{ success: true }`, `{ error }`).
 *
 * @param request - The request, with the key as `Authorization: Bearer`.
 * @returns 200 `{ success: true }`; 400, 401 or 500 `{ error }`.
 */
export async function postRunReportHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const t0 = performance.now();
  try {
    const apiKeyHash = await validateMcpApiKey(request);
    if (!apiKeyHash)
      return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401, headers });

    const body = validateRunReportBody(await request.json());
    if (body instanceof NextResponse) return body;

    await upsertRun({ ...body, apiKeyHash });

    console.debug(
      `[run-report] POST ${Math.round(performance.now() - t0)}ms worker=${body.workerId} run=${body.runNumber} status=${body.status}`,
    );
    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (e) {
    console.error("[run-report] POST error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}

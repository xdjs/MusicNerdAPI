import { NextResponse } from "next/server";
import { upsertHeartbeat } from "@/lib/agentReports/upsertHeartbeat";
import { validateHeartbeatBody } from "@/lib/agentReports/validateHeartbeatBody";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateMcpApiKey } from "@/lib/mcpAuth/validateMcpApiKey";

/**
 * Handles POST /api/agent/heartbeat: an MCP API key, a validated heartbeat,
 * one upsert. Responses keep the shapes the agent client expects
 * (`{ success: true }`, `{ error }`).
 *
 * @param request - The request, with the key as `Authorization: Bearer`.
 * @returns 200 `{ success: true }`; 400, 401 or 500 `{ error }`.
 */
export async function postHeartbeatHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const t0 = performance.now();
  try {
    const apiKeyHash = await validateMcpApiKey(request);
    if (!apiKeyHash)
      return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401, headers });

    const body = validateHeartbeatBody(await request.json());
    if (body instanceof NextResponse) return body;

    await upsertHeartbeat({ ...body, apiKeyHash });

    console.debug(
      `[heartbeat] POST ${Math.round(performance.now() - t0)}ms worker=${body.workerId} status=${body.status}`,
    );
    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (e) {
    console.error("[heartbeat] POST error", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}

import { postRunReportHandler } from "@/lib/agentRuns/postRunReportHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/run-report — upsert an agent run report.
 * Auth: MCP API key (Bearer token).
 *
 * @param request - The incoming request with Bearer auth and run report body.
 * @returns JSON `{ success: true }` or an error.
 */
export async function POST(request: Request) {
  return postRunReportHandler(request);
}

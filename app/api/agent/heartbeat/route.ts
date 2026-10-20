import { postHeartbeatHandler } from "@/lib/agentHeartbeat/postHeartbeatHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent/heartbeat — upsert an agent worker heartbeat.
 * Auth: MCP API key (Bearer token).
 *
 * @param request - The incoming request with Bearer auth and heartbeat body.
 * @returns JSON `{ success: true }` or an error.
 */
export async function POST(request: Request) {
  return postHeartbeatHandler(request);
}

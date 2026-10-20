import { revokeMcpKeyHandler } from "@/lib/mcpKeys/revokeMcpKeyHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * POST /api/admin/mcp-keys/{id}/revoke — revoke an MCP key. Admin only.
 *
 * @param request - The incoming request.
 * @param context - Route context.
 * @param context.params - The key id.
 * @returns `{ status, message }`, or 404 when there's no live key.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return revokeMcpKeyHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

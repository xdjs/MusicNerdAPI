import { getMcpKeysHandler } from "@/lib/mcpKeys/getMcpKeysHandler";
import { postMcpKeyHandler } from "@/lib/mcpKeys/postMcpKeyHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/mcp-keys — list MCP keys by hash prefix. Admin only.
 *
 * @param request - The incoming request.
 * @returns `{ status, keys }`, or an error.
 */
export async function GET(request: Request) {
  return getMcpKeysHandler(request);
}

/**
 * POST /api/admin/mcp-keys — create an MCP key. Admin only.
 *
 * @param request - Body `{ label }`.
 * @returns 201 with the raw key, shown only this once.
 */
export async function POST(request: Request) {
  return postMcpKeyHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}

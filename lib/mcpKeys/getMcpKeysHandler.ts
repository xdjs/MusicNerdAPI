import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/mcp-keys: every MCP key, newest first. Only the
 * first 8 characters of each hash leave the server.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ status, keys }`, 401/403, or 500.
 */
export async function getMcpKeysHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  try {
    const rows = await db.execute<{
      id: string;
      label: string;
      key_hash: string;
      created_at: string;
      revoked_at: string | null;
    }>(sql`select id, label, key_hash, created_at, revoked_at from mcp_api_keys
      order by created_at desc`);
    const keys = [...rows].map(k => ({
      id: k.id,
      label: k.label,
      keyHashPrefix: k.key_hash.slice(0, 8),
      createdAt: k.created_at,
      revokedAt: k.revoked_at,
    }));
    return NextResponse.json({ status: "ok", keys }, { headers });
  } catch (e) {
    console.error("[mcp-keys] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

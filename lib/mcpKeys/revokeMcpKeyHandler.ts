import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { db } from "@/lib/db/db";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/mcp-keys/{id}/revoke: soft-deletes a live key by
 * setting `revoked_at`. Keys are never hard-deleted.
 *
 * @param request - The incoming request.
 * @param id - The key id from the path.
 * @returns 200 when revoked, 404 when missing or already revoked, 401/403, or 500.
 */
export async function revokeMcpKeyHandler(request: Request, id: string): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  try {
    const rows = await db.execute<{ id: string }>(sql`update mcp_api_keys set revoked_at = now()
      where id::text = ${id} and revoked_at is null returning id`);
    if (!rows.length)
      return NextResponse.json(
        { status: "error", error: "Key not found" },
        { status: 404, headers },
      );
    return NextResponse.json({ status: "ok", message: "Key revoked" }, { headers });
  } catch (e) {
    console.error("[mcp-keys] revoke error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

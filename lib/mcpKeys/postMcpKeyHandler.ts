import crypto from "crypto";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { db } from "@/lib/db/db";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/mcp-keys: creates a key from a random 32 bytes and
 * stores only its hash. The raw key is returned once and never again.
 *
 * @param request - Body `{ label }`.
 * @returns 201 with `{ status, rawKey, label }`, 400 without a label, 401/403, or 500.
 */
export async function postMcpKeyHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label)
    return NextResponse.json(
      { status: "error", error: "Label is required" },
      { status: 400, headers },
    );
  try {
    const rawKey = crypto.randomBytes(32).toString("hex");
    await db.execute(
      sql`insert into mcp_api_keys (key_hash, label) values (${hashApiKey(rawKey)}, ${label})`,
    );
    return NextResponse.json({ status: "ok", rawKey, label }, { status: 201, headers });
  } catch (e) {
    console.error("[mcp-keys] POST error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

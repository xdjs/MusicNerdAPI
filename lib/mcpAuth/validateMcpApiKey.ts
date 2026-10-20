import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

/**
 * Validate a Bearer token against the mcp_api_keys table.
 * Returns the key hash on success, null if missing/invalid/revoked.
 *
 * @param request - The incoming request with an Authorization header.
 * @returns The SHA-256 key hash, or null.
 */
export async function validateMcpApiKey(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  const keyHash = hashApiKey(parts[1]);

  const rows = await db.execute<{ key_hash: string }>(sql`
    SELECT key_hash FROM mcp_api_keys
    WHERE key_hash = ${keyHash} AND revoked_at IS NULL
    LIMIT 1
  `);

  return rows.length > 0 ? keyHash : null;
}

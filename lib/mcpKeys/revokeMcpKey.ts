import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";

/**
 * Revokes an active MCP API key by setting `revoked_at`. Keys are never
 * deleted; the audit log keeps referring to their hash.
 *
 * @param id - The key's id.
 * @returns True when an active key was revoked; false when none matched (unknown or already revoked).
 */
export async function revokeMcpKey(id: string): Promise<boolean> {
  const result = await db
    .update(mcpApiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(mcpApiKeys.id, id), isNull(mcpApiKeys.revokedAt)))
    .returning({ id: mcpApiKeys.id });
  return result.length > 0;
}

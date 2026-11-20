import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";

/**
 * Revokes one of a member's working board agent keys by setting `revoked_at`.
 *
 * @param member - The member's board name.
 * @param id - The key's id.
 * @returns True when a key was revoked; false when the member has no working key with that id.
 */
export async function revokeBoardKey(member: string, id: string): Promise<boolean> {
  const result = await db
    .update(mcpApiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(eq(mcpApiKeys.id, id), eq(mcpApiKeys.boardMember, member), isNull(mcpApiKeys.revokedAt)),
    )
    .returning({ id: mcpApiKeys.id });
  return result.length > 0;
}

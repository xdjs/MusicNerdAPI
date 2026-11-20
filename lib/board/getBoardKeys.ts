import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";

/**
 * A member's board agent keys that still work, newest first.
 *
 * @param member - The member's board name.
 * @returns Each key's id, agent, profile and creation time.
 */
export async function getBoardKeys(
  member: string,
): Promise<{ id: string; agent: string; profile: string; createdAt: string }[]> {
  const rows = await db
    .select({ id: mcpApiKeys.id, agent: mcpApiKeys.label, createdAt: mcpApiKeys.createdAt })
    .from(mcpApiKeys)
    .where(and(eq(mcpApiKeys.boardMember, member), isNull(mcpApiKeys.revokedAt)))
    .orderBy(desc(mcpApiKeys.createdAt));
  return rows.map(row => ({ ...row, profile: `${row.agent}-${member}` }));
}

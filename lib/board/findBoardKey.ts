import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { parseBoardMembers } from "@/lib/board/parseBoardMembers";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

/**
 * The profile a board agent key posts as. The key must be a board key that
 * isn't revoked, and its member must still be on the team.
 *
 * @param rawKey - The key from the MCP URL.
 * @returns `<agent>-<member>`, or null.
 */
export async function findBoardKey(rawKey: string): Promise<string | null> {
  const row = await db.query.mcpApiKeys.findFirst({
    where: and(
      eq(mcpApiKeys.keyHash, hashApiKey(rawKey)),
      isNull(mcpApiKeys.revokedAt),
      isNotNull(mcpApiKeys.boardMember),
    ),
  });
  const member = row?.boardMember;
  if (!member) return null;
  const team = new Set(parseBoardMembers(process.env.BOARD_ALLOWED_EMAILS).values());
  return team.has(member) ? `${row.label}-${member}` : null;
}

import crypto from "node:crypto";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

/**
 * Makes a board agent key: an MCP key labelled with the agent's name and
 * marked with its member. Only the hash is stored; the raw key is returned once.
 *
 * @param member - The member's board name.
 * @param agent - The agent's name, already cleaned.
 * @returns The key's id and the raw key.
 */
export async function createBoardKey(
  member: string,
  agent: string,
): Promise<{ id: string; rawKey: string }> {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const [row] = await db
    .insert(mcpApiKeys)
    .values({ keyHash: hashApiKey(rawKey), label: agent, boardMember: member })
    .returning({ id: mcpApiKeys.id });
  return { id: row.id, rawKey };
}

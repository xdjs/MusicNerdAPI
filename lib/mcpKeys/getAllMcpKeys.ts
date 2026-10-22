import { desc } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";

/**
 * Every MCP API key, newest first, revoked ones included. Only the first 8
 * characters of the hash are exposed, to tell keys apart.
 *
 * @returns The keys as MusicNerdWeb's admin lists them.
 */
export async function getAllMcpKeys(): Promise<
  {
    id: string;
    label: string;
    keyHashPrefix: string;
    createdAt: string;
    revokedAt: string | null;
  }[]
> {
  const keys = await db
    .select({
      id: mcpApiKeys.id,
      label: mcpApiKeys.label,
      keyHash: mcpApiKeys.keyHash,
      createdAt: mcpApiKeys.createdAt,
      revokedAt: mcpApiKeys.revokedAt,
    })
    .from(mcpApiKeys)
    .orderBy(desc(mcpApiKeys.createdAt));

  // Only expose first 8 chars of hash for identification
  return keys.map(k => ({
    id: k.id,
    label: k.label,
    keyHashPrefix: k.keyHash.slice(0, 8),
    createdAt: k.createdAt,
    revokedAt: k.revokedAt,
  }));
}

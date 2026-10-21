import { and, eq, isNull } from "drizzle-orm";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

/**
 * The MCP API key gate: hashes the `Authorization: Bearer <key>` token and
 * looks the hash up among the keys that haven't been revoked. The SHA-256
 * prehash makes the direct lookup safe: timing only reveals whether a hash
 * exists, nothing about the key.
 *
 * @param request - The incoming request.
 * @returns The key's hash when it is valid, null when there is no Bearer token or the key is unknown or revoked.
 */
export async function validateMcpApiKey(request: Request): Promise<string | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const keyHash = hashApiKey(token);
  const row = await db.query.mcpApiKeys.findFirst({
    where: and(eq(mcpApiKeys.keyHash, keyHash), isNull(mcpApiKeys.revokedAt)),
  });
  return row ? keyHash : null;
}

import crypto from "node:crypto";
import { db } from "@/lib/db/db";
import { mcpApiKeys } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

/**
 * Creates an MCP API key: 32 random bytes as hex, stored only as its SHA-256
 * hash. The raw key is returned once and never again.
 *
 * @param label - What the key is for, already trimmed.
 * @returns The raw key and its label.
 */
export async function createMcpKey(label: string): Promise<{ rawKey: string; label: string }> {
  // Generate a cryptographically random key
  const rawKey = crypto.randomBytes(32).toString("hex");
  const keyHash = hashApiKey(rawKey);

  await db.insert(mcpApiKeys).values({ keyHash, label });

  return { rawKey, label };
}

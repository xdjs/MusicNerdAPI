import { db } from "@/lib/db/db";
import { oauthClients } from "@/lib/db/schema";

/**
 * Stores a registered client.
 *
 * @param name - The name the client gave, unverified.
 * @param redirectUris - Its allowed redirect URIs.
 * @returns The new `client_id`.
 */
export async function insertOAuthClient(name: string, redirectUris: string[]): Promise<string> {
  const [row] = await db
    .insert(oauthClients)
    .values({ name, redirectUris })
    .returning({ id: oauthClients.id });
  return row.id;
}

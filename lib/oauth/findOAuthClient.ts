import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { oauthClients } from "@/lib/db/schema";
import { UUID } from "@/lib/oauth/const";
import type { OAuthClient } from "@/lib/oauth/types";

/**
 * A registered client by its `client_id`.
 *
 * @param clientId - The `client_id` from the request.
 * @returns The client, or undefined when there is none (or the id isn't a UUID).
 */
export async function findOAuthClient(clientId: string): Promise<OAuthClient | undefined> {
  if (!UUID.test(clientId)) return undefined;
  return db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, clientId),
    columns: { id: true, name: true, redirectUris: true },
  });
}

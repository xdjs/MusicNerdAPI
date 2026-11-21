import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { createOAuthGrant } = await import("@/lib/oauth/createOAuthGrant");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("createOAuthGrant", () => {
  it("connects the client to the user", async () => {
    const { clientId, userId } = await seedGrant(client);
    const id = await createOAuthGrant(clientId, userId);
    const { rows } = await client.query(
      "select client_id, user_id, last_used_at from oauth_grants where id = $1",
      [id],
    );
    expect(rows).toEqual([{ client_id: clientId, user_id: userId, last_used_at: null }]);
  });
});

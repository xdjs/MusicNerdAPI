import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { listOAuthConnections } = await import("@/lib/oauth/listOAuthConnections");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("listOAuthConnections", () => {
  it("lists only the user's own grants, newest first, with the agent's name", async () => {
    const mine = await seedGrant(client);
    await seedGrant(client);
    const {
      rows: [newer],
    } = await client.query<{ id: string }>(
      "insert into oauth_grants(client_id, user_id, created_at, last_used_at) values($1, $2, now() + interval '1 minute', '2026-11-21T10:00:00Z') returning id",
      [mine.clientId, mine.userId],
    );
    const list = await listOAuthConnections(mine.userId);
    expect(list.map(c => c.id)).toEqual([newer.id, mine.grantId]);
    expect(list[0]).toEqual({
      id: newer.id,
      agent: "Claude",
      scopes: ["mcp:tools"],
      connectedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
      lastUsedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(list[1].lastUsedAt).toBeNull();
  });
});

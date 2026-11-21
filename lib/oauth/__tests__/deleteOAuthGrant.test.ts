import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { deleteOAuthGrant } = await import("@/lib/oauth/deleteOAuthGrant");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

const count = async (table: string) =>
  (await client.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;

describe("deleteOAuthGrant", () => {
  it("deletes the user's own grant and its tokens", async () => {
    const { grantId, userId } = await seedGrant(client);
    await issueOAuthToken(grantId, "access");
    await deleteOAuthGrant(grantId, userId);
    expect(await count("oauth_grants")).toBe(0);
    expect(await count("oauth_tokens")).toBe(0);
  });

  it("leaves another user's grant alone", async () => {
    const { grantId } = await seedGrant(client);
    const other = await seedGrant(client);
    await deleteOAuthGrant(grantId, other.userId);
    expect(await count("oauth_grants")).toBe(2);
  });

  it("does nothing for an id that isn't a UUID", async () => {
    const { userId } = await seedGrant(client);
    await deleteOAuthGrant("conn_7f3a2c", userId);
    expect(await count("oauth_grants")).toBe(1);
  });
});

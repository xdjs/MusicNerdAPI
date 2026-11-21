import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { deleteGrantOfUsedRefreshToken } = await import("@/lib/oauth/deleteGrantOfUsedRefreshToken");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");
const { consumeOAuthToken } = await import("@/lib/oauth/consumeOAuthToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

const grants = async () => (await client.query("select id from oauth_grants")).rows.length;

describe("deleteGrantOfUsedRefreshToken", () => {
  it("deletes the grant, and with it every token, when the refresh token was already used", async () => {
    const { grantId } = await seedGrant(client);
    const refresh = await issueOAuthToken(grantId, "refresh");
    await issueOAuthToken(grantId, "access");
    await consumeOAuthToken(refresh, "refresh");
    expect(await deleteGrantOfUsedRefreshToken(refresh)).toBe(true);
    expect(await grants()).toBe(0);
    expect((await client.query("select hash from oauth_tokens")).rows).toEqual([]);
  });

  it("leaves the grant alone for an unused or unknown token", async () => {
    const { grantId } = await seedGrant(client);
    const refresh = await issueOAuthToken(grantId, "refresh");
    expect(await deleteGrantOfUsedRefreshToken(refresh)).toBe(false);
    expect(await deleteGrantOfUsedRefreshToken("mn_rt_unknown")).toBe(false);
    expect(await grants()).toBe(1);
  });

  it("ignores a used code", async () => {
    const { grantId } = await seedGrant(client);
    const code = await issueOAuthToken(grantId, "code", {
      codeChallenge: "c".repeat(43),
      redirectUri: "https://a.example/cb",
    });
    await consumeOAuthToken(code, "code");
    expect(await deleteGrantOfUsedRefreshToken(code)).toBe(false);
    expect(await grants()).toBe(1);
  });
});

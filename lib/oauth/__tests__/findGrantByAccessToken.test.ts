import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { findGrantByAccessToken } = await import("@/lib/oauth/findGrantByAccessToken");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("findGrantByAccessToken", () => {
  it("maps a live access token to its grant, user and agent", async () => {
    const { grantId, userId } = await seedGrant(client, { email: "a@example.com", isAdmin: true });
    const access = await issueOAuthToken(grantId, "access");
    expect(await findGrantByAccessToken(access)).toEqual({
      grantId,
      userId,
      isAdmin: true,
      email: "a@example.com",
      agent: "Claude",
    });
  });

  it("refuses an access token older than five minutes", async () => {
    const { grantId } = await seedGrant(client);
    const access = await issueOAuthToken(grantId, "access");
    await client.exec("update oauth_tokens set expires_at = now() - interval '1 second'");
    expect(await findGrantByAccessToken(access)).toBeUndefined();
  });

  it("refuses a refresh token or code used as an access token", async () => {
    const { grantId } = await seedGrant(client);
    expect(await findGrantByAccessToken(await issueOAuthToken(grantId, "refresh"))).toBeUndefined();
  });

  it("refuses a token whose grant was deleted", async () => {
    const { grantId } = await seedGrant(client);
    const access = await issueOAuthToken(grantId, "access");
    await client.exec("delete from oauth_grants");
    expect(await findGrantByAccessToken(access)).toBeUndefined();
  });
});

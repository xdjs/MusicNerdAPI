import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { consumeOAuthToken } = await import("@/lib/oauth/consumeOAuthToken");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

const bound = { codeChallenge: "c".repeat(43), redirectUri: "http://127.0.0.1:33418/callback" };

describe("consumeOAuthToken", () => {
  it("marks the token used and returns its grant, client and binding", async () => {
    const { grantId, clientId } = await seedGrant(client);
    const code = await issueOAuthToken(grantId, "code", bound);
    expect(await consumeOAuthToken(code, "code")).toEqual({ grantId, clientId, ...bound });
  });

  it("works once: the second use finds nothing", async () => {
    const { grantId } = await seedGrant(client);
    const code = await issueOAuthToken(grantId, "code", bound);
    await consumeOAuthToken(code, "code");
    expect(await consumeOAuthToken(code, "code")).toBeUndefined();
  });

  it("lets only one of two simultaneous uses through", async () => {
    const { grantId } = await seedGrant(client);
    const refresh = await issueOAuthToken(grantId, "refresh");
    const results = await Promise.all([
      consumeOAuthToken(refresh, "refresh"),
      consumeOAuthToken(refresh, "refresh"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("refuses an expired token", async () => {
    const { grantId } = await seedGrant(client);
    const code = await issueOAuthToken(grantId, "code", bound);
    await client.exec("update oauth_tokens set expires_at = now() - interval '1 second'");
    expect(await consumeOAuthToken(code, "code")).toBeUndefined();
  });

  it("refuses a token of another kind, or an unknown one", async () => {
    const { grantId } = await seedGrant(client);
    const access = await issueOAuthToken(grantId, "access");
    expect(await consumeOAuthToken(access, "refresh")).toBeUndefined();
    expect(await consumeOAuthToken("mn_rt_unknown", "refresh")).toBeUndefined();
  });
});

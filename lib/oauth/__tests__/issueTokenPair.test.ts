import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { issueTokenPair } = await import("@/lib/oauth/issueTokenPair");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");
const { hashToken } = await import("@/lib/oauth/hashToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("issueTokenPair", () => {
  it("issues a five-minute access token and a refresh token for the grant", async () => {
    const { grantId } = await seedGrant(client);
    const pair = await issueTokenPair(grantId);
    expect(pair).toEqual({
      access_token: expect.stringMatching(/^mn_at_/),
      token_type: "Bearer",
      expires_in: 300,
      refresh_token: expect.stringMatching(/^mn_rt_/),
      scope: "mcp:tools",
    });
    const { rows } = await client.query("select hash, kind from oauth_tokens order by kind");
    expect(rows).toEqual([
      { hash: hashToken(pair.access_token), kind: "access" },
      { hash: hashToken(pair.refresh_token), kind: "refresh" },
    ]);
  });

  it("clears the grant's expired tokens and used codes, but keeps used refresh tokens for replay checks", async () => {
    const { grantId } = await seedGrant(client);
    const expired = await issueOAuthToken(grantId, "access");
    const code = await issueOAuthToken(grantId, "code", {
      codeChallenge: "c".repeat(43),
      redirectUri: "https://a.example/cb",
    });
    const usedRefresh = await issueOAuthToken(grantId, "refresh");
    await client.query(
      "update oauth_tokens set expires_at = now() - interval '1 second' where hash = $1",
      [hashToken(expired)],
    );
    await client.query("update oauth_tokens set used_at = now() where hash in ($1, $2)", [
      hashToken(code),
      hashToken(usedRefresh),
    ]);
    await issueTokenPair(grantId);
    const hashes = (await client.query<{ hash: string }>("select hash from oauth_tokens")).rows.map(
      r => r.hash,
    );
    expect(hashes).not.toContain(hashToken(expired));
    expect(hashes).not.toContain(hashToken(code));
    expect(hashes).toContain(hashToken(usedRefresh));
    expect(hashes).toHaveLength(3);
  });
});

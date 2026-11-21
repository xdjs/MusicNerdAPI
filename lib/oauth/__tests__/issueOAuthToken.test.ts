import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");
const { hashToken } = await import("@/lib/oauth/hashToken");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

const row = async (token: string) =>
  (
    await client.query<Record<string, unknown>>(
      "select hash, kind, round(extract(epoch from expires_at - created_at))::int as ttl, code_challenge, redirect_uri from oauth_tokens",
    )
  ).rows.find(r => r.hash === hashToken(token));

describe("issueOAuthToken", () => {
  it("stores only the hash of a code, valid 60 s and bound to the challenge and redirect", async () => {
    const { grantId } = await seedGrant(client);
    const code = await issueOAuthToken(grantId, "code", {
      codeChallenge: "c".repeat(43),
      redirectUri: "http://127.0.0.1:33418/callback",
    });
    expect(code.startsWith("mn_code_")).toBe(true);
    expect(await row(code)).toEqual({
      hash: hashToken(code),
      kind: "code",
      ttl: 60,
      code_challenge: "c".repeat(43),
      redirect_uri: "http://127.0.0.1:33418/callback",
    });
    const { rows } = await client.query(
      "select count(*)::int as n from oauth_tokens where hash = $1",
      [code],
    );
    expect(rows).toEqual([{ n: 0 }]);
  });

  it("gives an access token five minutes", async () => {
    const { grantId } = await seedGrant(client);
    expect((await row(await issueOAuthToken(grantId, "access")))?.ttl).toBe(300);
  });

  it("gives a refresh token no expiry", async () => {
    const { grantId } = await seedGrant(client);
    expect((await row(await issueOAuthToken(grantId, "refresh")))?.ttl).toBeNull();
  });
});

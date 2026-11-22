import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { pruneOAuthTokens } = await import("@/lib/oauth/pruneOAuthTokens");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");
const { hashToken } = await import("@/lib/oauth/hashToken");

const code = (grantId: string) =>
  issueOAuthToken(grantId, "code", {
    codeChallenge: "c".repeat(43),
    redirectUri: "https://a.example/cb",
  });
const set = (token: string, column: "expires_at" | "used_at", ago: string) =>
  client.query(`update oauth_tokens set ${column} = now() - $2::interval where hash = $1`, [
    hashToken(token),
    ago,
  ]);
const remaining = async () =>
  (await client.query<{ hash: string }>("select hash from oauth_tokens")).rows.map(r => r.hash);

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("pruneOAuthTokens", () => {
  it("deletes expired codes and access tokens, and keeps live ones", async () => {
    const { grantId } = await seedGrant(client);
    const oldCode = await code(grantId);
    const oldAccess = await issueOAuthToken(grantId, "access");
    const liveCode = await code(grantId);
    const liveAccess = await issueOAuthToken(grantId, "access");
    await set(oldCode, "expires_at", "1 second");
    await set(oldAccess, "expires_at", "1 second");

    expect(await pruneOAuthTokens()).toBe(2);
    expect((await remaining()).sort()).toEqual([hashToken(liveCode), hashToken(liveAccess)].sort());
  });

  it("deletes a used refresh token past the retention window once a newer one on its grant was used", async () => {
    const { grantId } = await seedGrant(client);
    const oldest = await issueOAuthToken(grantId, "refresh");
    const older = await issueOAuthToken(grantId, "refresh");
    const recent = await issueOAuthToken(grantId, "refresh");
    const unused = await issueOAuthToken(grantId, "refresh");
    await set(oldest, "used_at", "60 days");
    await set(older, "used_at", "40 days");
    await set(recent, "used_at", "1 day");

    expect(await pruneOAuthTokens()).toBe(2);
    expect((await remaining()).sort()).toEqual([hashToken(recent), hashToken(unused)].sort());
  });

  it("keeps the last used refresh token on a grant, however old", async () => {
    const { grantId } = await seedGrant(client);
    const older = await issueOAuthToken(grantId, "refresh");
    const last = await issueOAuthToken(grantId, "refresh");
    await set(older, "used_at", "90 days");
    await set(last, "used_at", "60 days");

    expect(await pruneOAuthTokens()).toBe(1);
    expect(await remaining()).toEqual([hashToken(last)]);
  });

  it("keeps used refresh tokens inside the retention window", async () => {
    const { grantId } = await seedGrant(client);
    const a = await issueOAuthToken(grantId, "refresh");
    const b = await issueOAuthToken(grantId, "refresh");
    await set(a, "used_at", "29 days");
    await set(b, "used_at", "1 minute");

    expect(await pruneOAuthTokens()).toBe(0);
    expect(await remaining()).toHaveLength(2);
  });

  it("judges each grant on its own", async () => {
    const one = await seedGrant(client);
    const two = await seedGrant(client);
    const oldOnOne = await issueOAuthToken(one.grantId, "refresh");
    const newOnTwo = await issueOAuthToken(two.grantId, "refresh");
    await set(oldOnOne, "used_at", "60 days");
    await set(newOnTwo, "used_at", "1 day");

    expect(await pruneOAuthTokens()).toBe(0);
  });
});

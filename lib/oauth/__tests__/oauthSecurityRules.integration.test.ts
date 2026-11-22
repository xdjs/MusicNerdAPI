import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seven rules the OAuth server's security rests on (xdjs/MusicNerdWeb#1696),
 * run through the real modules against the 0067 tables. Only the database
 * client is swapped for an in-memory Postgres.
 */
const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { insertOAuthClient } = await import("@/lib/oauth/insertOAuthClient");
const { validateAuthorizeRequest } = await import("@/lib/oauth/validateAuthorizeRequest");
const { createOAuthGrant } = await import("@/lib/oauth/createOAuthGrant");
const { issueOAuthToken } = await import("@/lib/oauth/issueOAuthToken");
const { postTokenHandler } = await import("@/lib/oauth/postTokenHandler");
const { findGrantByAccessToken } = await import("@/lib/oauth/findGrantByAccessToken");
const { hashToken } = await import("@/lib/oauth/hashToken");
const { pruneOAuthTokens } = await import("@/lib/oauth/pruneOAuthTokens");

const origin = "https://api.musicnerd.net";
const redirect = "http://127.0.0.1:33418/callback";
// RFC 7636 appendix B.
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

let clientId: string;
let grantId: string;

const token = async (body: Record<string, string>) => {
  const res = await postTokenHandler(
    new Request(`${origin}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, ...body }).toString(),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, string | number> };
};
const exchange = (code: string, over: Record<string, string> = {}) =>
  token({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirect,
    ...over,
  });
const refresh = (refreshToken: string) =>
  token({ grant_type: "refresh_token", refresh_token: refreshToken });
const newCode = () =>
  issueOAuthToken(grantId, "code", { codeChallenge: challenge, redirectUri: redirect });

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
  const {
    rows: [user],
  } = await client.query<{ id: string }>("insert into users default values returning id");
  clientId = await insertOAuthClient("Claude", [redirect]);
  grantId = await createOAuthGrant(clientId, user.id);
});
afterAll(async () => client.close());

describe("OAuth security rules", () => {
  it("1. the redirect URI must match exactly, at authorization and at the token endpoint", async () => {
    const request = {
      response_type: "code",
      client_id: clientId,
      code_challenge: challenge,
      code_challenge_method: "S256",
    };
    expect(
      await validateAuthorizeRequest({ ...request, redirect_uri: `${redirect}/` }, origin),
    ).toEqual({ ok: false, redirectUri: null });
    expect(
      await validateAuthorizeRequest({ ...request, redirect_uri: redirect }, origin),
    ).toMatchObject({ ok: true });
    expect(
      (await exchange(await newCode(), { redirect_uri: "http://127.0.0.1:33418/other" })).body,
    ).toMatchObject({ error: "invalid_grant" });
  });

  it("2. PKCE S256 is required: plain is refused, and only the right verifier redeems a code", async () => {
    expect(
      await validateAuthorizeRequest(
        {
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirect,
          code_challenge: challenge,
          code_challenge_method: "plain",
        },
        origin,
      ),
    ).toMatchObject({ ok: false, error: "invalid_request" });
    expect((await exchange(await newCode(), { code_verifier: "x".repeat(43) })).body).toMatchObject(
      { error: "invalid_grant" },
    );
    expect((await exchange(await newCode())).status).toBe(200);
  });

  it("3. a code works once, and not after 60 seconds", async () => {
    const code = await newCode();
    expect((await exchange(code)).status).toBe(200);
    expect(await exchange(code)).toEqual({
      status: 400,
      body: { error: "invalid_grant", error_description: expect.any(String) },
    });

    const late = await newCode();
    await client.query(
      "update oauth_tokens set expires_at = now() - interval '1 second' where hash = $1",
      [hashToken(late)],
    );
    expect((await exchange(late)).body).toMatchObject({ error: "invalid_grant" });
  });

  it("4. refresh tokens rotate, and replaying a used one disconnects the agent", async () => {
    const first = (await exchange(await newCode())).body;
    const second = await refresh(String(first.refresh_token));
    expect(second.status).toBe(200);
    expect(second.body.refresh_token).not.toBe(first.refresh_token);
    expect(await findGrantByAccessToken(String(second.body.access_token))).toMatchObject({
      grantId,
    });

    expect((await refresh(String(first.refresh_token))).body).toMatchObject({
      error: "invalid_grant",
    });
    expect((await client.query("select id from oauth_grants")).rows).toEqual([]);
    expect(await findGrantByAccessToken(String(second.body.access_token))).toBeUndefined();
    expect((await refresh(String(second.body.refresh_token))).body).toMatchObject({
      error: "invalid_grant",
    });
  });

  it("5. tokens are stored only as SHA-256 hashes", async () => {
    const stored = async () =>
      JSON.stringify((await client.query("select * from oauth_tokens")).rows);
    const code = await newCode();
    expect(await stored()).toContain(hashToken(code));
    expect(await stored()).not.toContain(code);
    const pair = (await exchange(code)).body;
    for (const t of [String(pair.access_token), String(pair.refresh_token)]) {
      expect(await stored()).toContain(hashToken(t));
      expect(await stored()).not.toContain(t);
    }
  });

  it("6. access tokens last five minutes", async () => {
    const pair = (await exchange(await newCode())).body;
    expect(pair.expires_in).toBe(300);
    const access = String(pair.access_token);
    const {
      rows: [ttl],
    } = await client.query<{ seconds: number }>(
      "select round(extract(epoch from expires_at - created_at))::int as seconds from oauth_tokens where hash = $1",
      [hashToken(access)],
    );
    expect(ttl.seconds).toBe(300);
    expect(await findGrantByAccessToken(access)).toMatchObject({ grantId });
    await client.query(
      "update oauth_tokens set expires_at = now() - interval '1 second' where hash = $1",
      [hashToken(access)],
    );
    expect(await findGrantByAccessToken(access)).toBeUndefined();
  });

  it("7. pruning keeps replay protection: replaying the last used refresh token still disconnects the agent", async () => {
    let pair = (await exchange(await newCode())).body;
    const used: string[] = [];
    for (let i = 0; i < 3; i++) {
      used.push(String(pair.refresh_token));
      pair = (await refresh(String(pair.refresh_token))).body;
    }
    // Every used refresh token is now past the retention window, and every access token expired.
    await client.query(
      "update oauth_tokens set used_at = used_at - interval '60 days' where used_at is not null",
    );
    await client.query(
      "update oauth_tokens set expires_at = now() - interval '1 second' where kind = 'access'",
    );
    // The four access tokens, and every used refresh token but the last.
    expect(await pruneOAuthTokens()).toBe(6);
    const kinds = await client.query<{ kind: string; used: boolean }>(
      "select kind, used_at is not null as used from oauth_tokens order by kind, used",
    );
    expect(kinds.rows).toEqual([
      { kind: "refresh", used: false },
      { kind: "refresh", used: true },
    ]);

    expect((await refresh(used[0])).body).toMatchObject({ error: "invalid_grant" });
    expect((await client.query("select id from oauth_grants")).rows).toHaveLength(1);

    expect((await refresh(used[2])).body).toMatchObject({ error: "invalid_grant" });
    expect((await client.query("select id from oauth_grants")).rows).toEqual([]);
    expect((await refresh(String(pair.refresh_token))).body).toMatchObject({
      error: "invalid_grant",
    });
  });
});

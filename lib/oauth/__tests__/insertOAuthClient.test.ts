import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));

const { insertOAuthClient } = await import("@/lib/oauth/insertOAuthClient");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("insertOAuthClient", () => {
  it("stores the client and returns its id", async () => {
    const id = await insertOAuthClient("Claude", ["http://127.0.0.1:33418/callback"]);
    const { rows } = await client.query("select id, name, redirect_uris from oauth_clients");
    expect(rows).toEqual([
      { id, name: "Claude", redirect_uris: ["http://127.0.0.1:33418/callback"] },
    ]);
  });
});

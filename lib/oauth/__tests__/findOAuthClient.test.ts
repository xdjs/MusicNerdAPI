import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { findOAuthClient } = await import("@/lib/oauth/findOAuthClient");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("findOAuthClient", () => {
  it("returns the client's name and redirect URIs", async () => {
    const { clientId } = await seedGrant(client);
    expect(await findOAuthClient(clientId)).toEqual({
      id: clientId,
      name: "Claude",
      redirectUris: ["http://127.0.0.1:33418/callback"],
    });
  });

  it("is undefined for an unknown id, or one that isn't a UUID, without a database error", async () => {
    expect(await findOAuthClient("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    expect(await findOAuthClient("not-a-uuid")).toBeUndefined();
  });
});

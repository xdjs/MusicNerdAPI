import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createOAuthDatabase } = await import("@/lib/oauth/__tests__/oauthDatabase");
  return createOAuthDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { seedGrant } = await import("@/lib/oauth/__tests__/oauthDatabase");

const { touchOAuthGrant } = await import("@/lib/oauth/touchOAuthGrant");

beforeEach(async () => {
  await client.exec("delete from oauth_clients; delete from users");
});
afterAll(async () => client.close());

describe("touchOAuthGrant", () => {
  it("sets the grant's last_used_at", async () => {
    const { grantId } = await seedGrant(client);
    await touchOAuthGrant(grantId);
    const { rows } = await client.query<{ used: boolean }>(
      "select last_used_at > now() - interval '1 minute' as used from oauth_grants",
    );
    expect(rows).toEqual([{ used: true }]);
  });
});

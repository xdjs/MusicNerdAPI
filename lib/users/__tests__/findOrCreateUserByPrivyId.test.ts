import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
const { getPrivyUser } = vi.hoisted(() => ({ getPrivyUser: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db }));
vi.mock("@/lib/auth/getPrivyUser", () => ({ getPrivyUser }));
const { findOrCreateUserByPrivyId } = await import("@/lib/users/findOrCreateUserByPrivyId");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(async () => {
  await client.exec("delete from users");
  getPrivyUser.mockReset();
});
afterAll(async () => client.close());

describe("findOrCreateUserByPrivyId", () => {
  it("returns the existing row without asking Privy", async () => {
    await client.query(
      "insert into users(id, username, privy_user_id, is_admin) values($1, 'Vinyl Otter', 'did:privy:x', true)",
      [id],
    );
    const user = await findOrCreateUserByPrivyId("did:privy:x");
    expect(user).toMatchObject({ id, username: "Vinyl Otter", isAdmin: true });
    expect(getPrivyUser).not.toHaveBeenCalled();
  });

  it("creates a row with the Privy email on first sight", async () => {
    getPrivyUser.mockResolvedValue({ id: "did:privy:new", email: { address: "fan@example.com" } });
    const user = await findOrCreateUserByPrivyId("did:privy:new");
    expect(user).toMatchObject({
      privyUserId: "did:privy:new",
      email: "fan@example.com",
      username: null,
      wallet: null,
      isAdmin: false,
      isWhiteListed: false,
      isSuperAdmin: false,
      isHidden: false,
      legacyLinkDismissed: false,
    });
    const { rows } = await client.query("select count(*)::int as n from users");
    expect(rows).toEqual([{ n: 1 }]);
    expect(getPrivyUser).toHaveBeenCalledWith("did:privy:new");
  });

  it("creates a row without an email when Privy has none or can't be reached", async () => {
    getPrivyUser.mockResolvedValue(null);
    const user = await findOrCreateUserByPrivyId("did:privy:new");
    expect(user).toMatchObject({ privyUserId: "did:privy:new", email: null });
  });

  it("returns the same row when called twice", async () => {
    getPrivyUser.mockResolvedValue(null);
    const first = await findOrCreateUserByPrivyId("did:privy:new");
    const second = await findOrCreateUserByPrivyId("did:privy:new");
    expect(second.id).toBe(first.id);
    const { rows } = await client.query("select count(*)::int as n from users");
    expect(rows).toEqual([{ n: 1 }]);
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { getUserById } = await import("@/lib/users/getUserById");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(async () => {
  await client.exec("delete from users");
});
afterAll(async () => client.close());

describe("getUserById", () => {
  it("returns the whole row with camelCase fields", async () => {
    await client.query(
      "insert into users(id, username, username_needs_confirmation, privy_user_id, is_admin, accepted_ugc_count) values($1, 'Vinyl Otter', true, 'did:privy:x', false, 3)",
      [id],
    );
    const user = await getUserById(id);
    expect(user).toMatchObject({
      id,
      email: null,
      username: "Vinyl Otter",
      usernameNeedsConfirmation: true,
      usernamePromptedAt: null,
      wallet: null,
      privyUserId: "did:privy:x",
      legacyId: null,
      isAdmin: false,
      isWhiteListed: false,
      isSuperAdmin: false,
      isHidden: false,
      legacyLinkDismissed: false,
      acceptedUgcCount: 3,
    });
    expect(typeof user?.createdAt).toBe("string");
    expect(typeof user?.updatedAt).toBe("string");
  });

  it("is undefined for an unknown id", async () => {
    expect(await getUserById(id)).toBeUndefined();
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_NAME_FIRST, USER_NAME_SECOND } from "@/lib/users/const";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { setUserName } = await import("@/lib/users/setUserName");

const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = async (id: string) =>
  (
    await client.query<{
      username: string | null;
      username_needs_confirmation: boolean;
      updated_at: string;
    }>("select username, username_needs_confirmation, updated_at from users where id = $1", [id])
  ).rows[0];

beforeEach(async () => {
  await client.exec("delete from users");
  await client.query(
    "insert into users(id, username, username_needs_confirmation, updated_at) values($1, null, false, '2020-01-01T00:00:00Z')",
    [me],
  );
});
afterAll(async () => client.close());

describe("setUserName", () => {
  it("saves a chosen name, trimmed, clears the confirmation flag and bumps updated_at", async () => {
    await client.query("update users set username = 'Old', username_needs_confirmation = true", []);
    expect(await setUserName(me, "  Vinyl Otter ")).toEqual({
      username: "Vinyl Otter",
      usernameNeedsConfirmation: false,
    });
    const saved = await row(me);
    expect(saved).toMatchObject({ username: "Vinyl Otter", username_needs_confirmation: false });
    expect(new Date(saved.updated_at).getTime()).toBeGreaterThan(Date.UTC(2020, 0, 2));
  });

  it("refuses a name another account holds, compared trimmed and case-insensitively", async () => {
    await client.query("insert into users(id, username) values($1, ' vinyl OTTER ')", [other]);
    await expect(setUserName(me, "Vinyl Otter")).rejects.toThrow(
      "That user name is already taken. Try another.",
    );
    expect((await row(me)).username).toBeNull();
  });

  it("lets an account keep its own name in a different case", async () => {
    await client.query("update users set username = 'vinyl otter'", []);
    expect((await setUserName(me, "Vinyl Otter")).username).toBe("Vinyl Otter");
  });

  it("refuses an invalid requested name before touching the database", async () => {
    await expect(setUserName(me, "someone@example.com")).rejects.toThrow(
      "Choose a user name instead of an email or wallet address.",
    );
    await expect(setUserName(me, "")).rejects.toThrow("User name is required.");
    expect((await row(me)).username).toBeNull();
  });

  it("refuses the account's own wallet address as its name", async () => {
    await client.query("update users set wallet = 'SoLaNaWaLLeT'", []);
    await expect(setUserName(me, "solanawallet")).rejects.toThrow(
      "Choose a user name instead of an email or wallet address.",
    );
  });

  it("throws for an unknown account", async () => {
    await expect(setUserName(other, "Vinyl Otter")).rejects.toThrow("Account not found.");
  });

  it("assigns a generated name that needs confirmation when the account has none", async () => {
    const result = await setUserName(me);
    const [first, second] = result.username.split(" ");
    expect(USER_NAME_FIRST).toContain(first);
    expect(USER_NAME_SECOND).toContain(second);
    expect(result.usernameNeedsConfirmation).toBe(true);
    expect(await row(me)).toMatchObject({
      username: result.username,
      username_needs_confirmation: true,
    });
  });

  it("leaves a usable name alone when no name is requested", async () => {
    await client.query(
      "update users set username = 'Vinyl Otter', username_needs_confirmation = true",
      [],
    );
    expect(await setUserName(me)).toEqual({
      username: "Vinyl Otter",
      usernameNeedsConfirmation: true,
    });
    expect(new Date((await row(me)).updated_at).getTime()).toBe(Date.UTC(2020, 0, 1));
  });

  it("replaces an email used as the name when no name is requested", async () => {
    await client.query("update users set username = 'someone@example.com'", []);
    const result = await setUserName(me);
    expect(result.username).not.toContain("@");
    expect(result.usernameNeedsConfirmation).toBe(true);
  });
});

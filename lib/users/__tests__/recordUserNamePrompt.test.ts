import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { recordUserNamePrompt } = await import("@/lib/users/recordUserNamePrompt");

const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const promptedAt = async () =>
  (
    await client.query<{ username_prompted_at: string | null }>(
      "select username_prompted_at from users where id = $1",
      [me],
    )
  ).rows[0]?.username_prompted_at;

beforeEach(async () => {
  await client.exec("delete from users");
});
afterAll(async () => client.close());

describe("recordUserNamePrompt", () => {
  it("records the first prompt for a generated name and says to show it", async () => {
    await client.query("insert into users(id, username_needs_confirmation) values($1, true)", [me]);
    expect(await recordUserNamePrompt(me)).toBe(true);
    expect(await promptedAt()).not.toBeNull();
  });

  it("does not show it again once recorded", async () => {
    await client.query(
      "insert into users(id, username_needs_confirmation, username_prompted_at) values($1, true, now())",
      [me],
    );
    expect(await recordUserNamePrompt(me)).toBe(false);
  });

  it("does not show it when the name is confirmed, or for an unknown account", async () => {
    await client.query("insert into users(id, username_needs_confirmation) values($1, false)", [
      me,
    ]);
    expect(await recordUserNamePrompt(me)).toBe(false);
    expect(await promptedAt()).toBeNull();
    expect(await recordUserNamePrompt("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBe(false);
  });
});

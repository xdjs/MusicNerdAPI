import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { dismissLegacyLink } = await import("@/lib/users/dismissLegacyLink");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(async () => {
  await client.exec("delete from users");
  await client.query(
    "insert into users(id, updated_at) values($1, '2026-01-01'), ($2, '2026-01-01')",
    [id, other],
  );
});
afterAll(async () => client.close());

describe("dismissLegacyLink", () => {
  it("sets legacy_link_dismissed and updated_at on that account only", async () => {
    await dismissLegacyLink(id);
    const { rows } = await client.query<{
      id: string;
      legacy_link_dismissed: boolean;
      fresh: boolean;
    }>(
      "select id, legacy_link_dismissed, updated_at > '2026-01-02' as fresh from users order by id",
    );
    expect(rows).toEqual([
      { id, legacy_link_dismissed: true, fresh: true },
      { id: other, legacy_link_dismissed: false, fresh: false },
    ]);
  });

  it("throws for an unknown account", async () => {
    await expect(dismissLegacyLink("cccccccc-cccc-4ccc-8ccc-cccccccccccc")).rejects.toThrow(
      "User not found",
    );
  });
});

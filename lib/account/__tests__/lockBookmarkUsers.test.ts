import { describe, it, expect } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";
import { lockBookmarkUsers } from "@/lib/account/lockBookmarkUsers";

const USER = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";

describe("lockBookmarkUsers", () => {
  it("locks the account rows for update, deduplicated and in a stable order", async () => {
    const { tx, log } = mockTransaction([[{ id: USER }, { id: LEGACY }]]);
    await lockBookmarkUsers(tx as never, [LEGACY, USER, LEGACY]);
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe("select for update");
    expect(log[0].text).toContain('"users"."id" in ($1, $2)');
    expect(log[0].params).toEqual([USER, LEGACY]);
  });

  it("throws when an account no longer exists", async () => {
    const { tx } = mockTransaction([[{ id: USER }]]);
    await expect(lockBookmarkUsers(tx as never, [USER, LEGACY])).rejects.toThrow(
      "Bookmark account no longer exists",
    );
  });
});

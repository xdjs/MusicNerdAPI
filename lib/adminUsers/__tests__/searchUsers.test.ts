import { afterAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { searchUsers } = await import("@/lib/adminUsers/searchUsers");

afterAll(() => test.client.close());

describe("searchUsers", () => {
  it("lists every user with email and role flags, by username", async () => {
    expect(await searchUsers()).toEqual([
      {
        id: ids.admin,
        username: "admin",
        email: "admin@example.com",
        wallet: null,
        isAdmin: true,
        isWhiteListed: false,
        isHidden: false,
        updatedAt: expect.stringContaining("2026-10-22"),
      },
      expect.objectContaining({ id: ids.otherUser, username: "hidden_fan", isHidden: true }),
      expect.objectContaining({ id: ids.user, username: "salsero", isWhiteListed: true }),
    ]);
  });

  it("matches the wallet or username, case-insensitive", async () => {
    expect((await searchUsers("SALS")).map(u => u.id)).toEqual([ids.user]);
    expect((await searchUsers("0xab")).map(u => u.id)).toEqual([ids.otherUser]);
  });

  it("is empty when nobody matches", async () => {
    expect(await searchUsers("zzz")).toEqual([]);
  });
});

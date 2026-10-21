import { describe, it, expect } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";
import { existingBookmarks } from "@/lib/account/existingBookmarks";

describe("existingBookmarks", () => {
  it("reads the account's current bookmarks in saved order", async () => {
    const rows = [{ artistId: "a", createdAt: "2026-09-06T12:00:00Z" }];
    const { tx, log } = mockTransaction([rows]);
    expect(await existingBookmarks(tx as never, "u1")).toEqual(rows);
    expect(log[0].params).toEqual(["u1"]);
    expect(log[0].text).toContain('"removed_at" is null');
  });
});

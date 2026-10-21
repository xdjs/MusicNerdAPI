import { describe, it, expect, vi } from "vitest";

const editUserBookmarks = vi.hoisted(() => vi.fn());
vi.mock("@/lib/account/editUserBookmarks", () => ({ editUserBookmarks }));
const { removeUserBookmark } = await import("@/lib/account/removeUserBookmark");

describe("removeUserBookmark", () => {
  it("is an edit that removes one artist and reorders nothing", async () => {
    editUserBookmarks.mockResolvedValueOnce([]);
    expect(await removeUserBookmark("u1", "a1")).toEqual([]);
    expect(editUserBookmarks).toHaveBeenCalledWith("u1", [], ["a1"]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artists: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { instagramHandleFor } = await import("@/lib/instagram/instagramHandleFor");

beforeEach(() => findFirst.mockReset());

describe("instagramHandleFor", () => {
  it("returns the trimmed handle, null when unset, and 'error' when the lookup fails", async () => {
    findFirst.mockResolvedValueOnce({ instagram: " biorritmo " });
    expect(await instagramHandleFor("a")).toBe("biorritmo");
    findFirst.mockResolvedValueOnce({ instagram: "  " });
    expect(await instagramHandleFor("a")).toBeNull();
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await instagramHandleFor("a")).toBe("error");
  });
});

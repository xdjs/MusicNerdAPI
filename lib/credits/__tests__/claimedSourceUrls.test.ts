import { describe, it, expect, vi, beforeEach } from "vitest";

const where = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: { select: () => ({ from: () => ({ where: (...a: unknown[]) => where(...a) }) }) },
}));
const { claimedSourceUrls } = await import("@/lib/credits/claimedSourceUrls");

beforeEach(() => {
  where.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("claimedSourceUrls", () => {
  it("is the set of posts that already have a credit or statement", async () => {
    where.mockResolvedValueOnce([{ url: "a" }, { url: "b" }, { url: "a" }]);
    expect(await claimedSourceUrls("a1")).toEqual(new Set(["a", "b"]));
  });

  it("is empty on a database error or without an artist", async () => {
    where.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await claimedSourceUrls("a1")).toEqual(new Set());
    expect(await claimedSourceUrls("")).toEqual(new Set());
  });
});

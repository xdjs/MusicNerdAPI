import { describe, it, expect, vi, beforeEach } from "vitest";

const limit = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: (...a: unknown[]) => limit(...a) }) }),
    }),
  },
}));
const { hasSocialPosts } = await import("@/lib/instagram/hasSocialPosts");

beforeEach(() => limit.mockReset());

describe("hasSocialPosts", () => {
  it("is true when any post exists and fails closed on error", async () => {
    limit.mockResolvedValueOnce([{ id: "p" }]);
    expect(await hasSocialPosts("a")).toBe(true);
    limit.mockResolvedValueOnce([]);
    expect(await hasSocialPosts("a")).toBe(false);
    limit.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await hasSocialPosts("a")).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_q: SQL): Promise<unknown> => []) }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { contradictsScrapedPosts } = await import("@/lib/identity/contradictsScrapedPosts");

beforeEach(() => execute.mockReset().mockResolvedValue([]));

describe("contradictsScrapedPosts", () => {
  it("is true when the artist's own posts are authored by a different handle", async () => {
    execute.mockResolvedValueOnce([{ owner_username: "pharaohsistare" }]);
    expect(await contradictsScrapedPosts("a1", "instagram", "pherosistar")).toBe(true);
  });

  it("is false when the handle matches, ignoring case and @", async () => {
    execute.mockResolvedValueOnce([{ owner_username: "PharaohSistare" }]);
    expect(await contradictsScrapedPosts("a1", "instagram", "@pharaohsistare")).toBe(false);
  });

  it("has no opinion without scraped posts, or on another platform", async () => {
    expect(await contradictsScrapedPosts("a1", "instagram", "anyone")).toBe(false);
    expect(await contradictsScrapedPosts("a1", "x", "anyone")).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("fails open on a database error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await contradictsScrapedPosts("a1", "instagram", "anyone")).toBe(false);
    err.mockRestore();
  });
});

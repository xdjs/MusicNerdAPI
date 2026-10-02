import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { hasSocialPosts } = vi.hoisted(() => ({ hasSocialPosts: vi.fn() }));
vi.mock("@/lib/instagram/hasSocialPosts", () => ({ hasSocialPosts }));
const { waitForSocialPosts } = await import("@/lib/instagram/waitForSocialPosts");

beforeEach(() => {
  vi.useFakeTimers();
  hasSocialPosts.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("waitForSocialPosts", () => {
  it("returns true as soon as posts exist", async () => {
    hasSocialPosts.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const done = waitForSocialPosts("a1", 5000, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(done).resolves.toBe(true);
    expect(hasSocialPosts).toHaveBeenCalledTimes(2);
  });

  it("gives up with false once the timeout passes", async () => {
    hasSocialPosts.mockResolvedValue(false);
    const done = waitForSocialPosts("a1", 2500, 1000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(done).resolves.toBe(false);
  });
});

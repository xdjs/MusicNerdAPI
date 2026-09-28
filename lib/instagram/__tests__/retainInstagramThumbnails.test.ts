import { describe, it, expect, vi, beforeEach } from "vitest";

const retainOne = vi.fn();
vi.mock("@/lib/instagram/retainInstagramThumbnail", () => ({
  retainInstagramThumbnail: (...args: unknown[]) => retainOne(...args),
}));

const { retainInstagramThumbnails } = await import("@/lib/instagram/retainInstagramThumbnails");

beforeEach(() => retainOne.mockReset());

describe("retainInstagramThumbnails", () => {
  it("skips collaborator posts and caps work at three in flight", async () => {
    let active = 0;
    let max = 0;
    retainOne.mockImplementation(async (raw: object) => {
      active++;
      max = Math.max(max, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return { ...raw, _musicnerdThumbnail: { version: 1 } };
    });
    const rows = Array.from({ length: 7 }, (_, index) => ({
      artistId: "a",
      platformPostId: String(index),
      isOwnPost: index !== 6,
      raw: { displayUrl: "x" },
    }));
    const result = await retainInstagramThumbnails(rows);
    expect(max).toBeLessThanOrEqual(3);
    expect(result.slice(0, 6).every(row => "_musicnerdThumbnail" in (row.raw as object))).toBe(
      true,
    );
    expect(result[6]).toEqual(rows[6]);
    expect(retainOne).toHaveBeenCalledTimes(6);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { listProfileImages, removeProfileImages } = vi.hoisted(() => ({
  listProfileImages: vi.fn(),
  removeProfileImages: vi.fn(),
}));
vi.mock("@/lib/artistImages/listProfileImages", () => ({ listProfileImages }));
vi.mock("@/lib/artistImages/removeProfileImages", () => ({ removeProfileImages }));
const { purgeStaleProfileImages } = await import("@/lib/artistImages/purgeStaleProfileImages");

const NOW = Date.parse("2026-10-21T12:00:00Z");
const old = new Date(NOW - 60_000).toISOString();
const fresh = new Date(NOW - 5_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  listProfileImages.mockReset();
  removeProfileImages.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("purgeStaleProfileImages", () => {
  it("removes the artist's older uploads, keeping the new file, recent ones, other artists' and undated ones", async () => {
    listProfileImages.mockResolvedValueOnce([
      { name: "a_1.png", created_at: old },
      { name: "a_2.png", created_at: old },
      { name: "a_3.png", created_at: fresh },
      { name: "a_4.png", created_at: "not a date" },
      { name: "a_5.png" },
      { name: "ba_6.png", created_at: old },
    ]);
    await purgeStaleProfileImages("a", "a_2.png");
    expect(removeProfileImages).toHaveBeenCalledWith(["profile-images/a_1.png"]);
    expect(console.log).toHaveBeenCalledWith(
      "[artist/profile-image] Purged 1 stale image(s) for artist a",
    );
  });

  it("removes nothing when nothing is stale", async () => {
    listProfileImages.mockResolvedValueOnce([{ name: "a_1.png", created_at: fresh }]);
    await purgeStaleProfileImages("a", "a_1.png");
    expect(removeProfileImages).not.toHaveBeenCalled();
  });

  it("never throws: a list or remove failure is logged", async () => {
    listProfileImages.mockRejectedValueOnce(new Error("list down"));
    await expect(purgeStaleProfileImages("a", "a_1.png")).resolves.toBeUndefined();
    listProfileImages.mockResolvedValueOnce([{ name: "a_0.png", created_at: old }]);
    removeProfileImages.mockRejectedValueOnce(new Error("remove down"));
    await expect(purgeStaleProfileImages("a", "a_1.png")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

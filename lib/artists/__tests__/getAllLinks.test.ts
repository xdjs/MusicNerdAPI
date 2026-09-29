import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { urlmap: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));

beforeEach(() => {
  vi.resetModules();
  findMany.mockReset();
});
afterEach(() => vi.useRealTimers());

const rows = [
  { siteName: "instagram" },
  { siteName: "catalog" },
  { siteName: "foundation" },
  { siteName: "soundxyz" },
  { siteName: "sound" },
  { siteName: "x" },
];

describe("getAllLinks", () => {
  it("drops the platforms discovery never resolves", async () => {
    findMany.mockResolvedValueOnce(rows);
    const { getAllLinks } = await import("@/lib/artists/getAllLinks");
    expect((await getAllLinks()).map(r => r.siteName)).toEqual(["instagram", "x"]);
  });

  it("memoizes for 60 s, then reads again", async () => {
    vi.useFakeTimers();
    findMany.mockResolvedValue(rows);
    const { getAllLinks } = await import("@/lib/artists/getAllLinks");
    await getAllLinks();
    await getAllLinks();
    expect(findMany).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001);
    await getAllLinks();
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

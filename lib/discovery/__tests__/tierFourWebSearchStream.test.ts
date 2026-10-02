import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchPlatformCandidates } = vi.hoisted(() => ({ searchPlatformCandidates: vi.fn() }));
vi.mock("@/lib/discovery/searchPlatformCandidates", () => ({ searchPlatformCandidates }));
const { tierFourWebSearchStream } = await import("@/lib/discovery/tierFourWebSearchStream");

beforeEach(() => {
  searchPlatformCandidates.mockReset().mockResolvedValue([]);
});

describe("tierFourWebSearchStream", () => {
  it("runs one search per missing handle platform with one query, never Spotify or Deezer", async () => {
    const out = [];
    for await (const x of tierFourWebSearchStream(
      "Pete Rango",
      null,
      new Set(["spotify", "instagram", "x"]),
    ))
      out.push(x);
    expect(out.map(([p]) => p).sort()).toEqual(["instagram", "x"]);
    expect(searchPlatformCandidates.mock.calls.map(c => c[1])).toEqual([
      "Pete Rango music artist",
      "Pete Rango music artist",
    ]);
  });
});

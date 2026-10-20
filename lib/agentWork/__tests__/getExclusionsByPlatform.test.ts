import { describe, it, expect, vi } from "vitest";

const { execute, exclusions } = vi.hoisted(() => ({ execute: vi.fn(), exclusions: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
vi.mock("@/lib/agentWork/getMappingExclusions", () => ({ getMappingExclusions: exclusions }));
const { getExclusionsByPlatform } = await import("@/lib/agentWork/getExclusionsByPlatform");

describe("getExclusionsByPlatform", () => {
  it("reads only valid platforms that have exclusions", async () => {
    execute.mockResolvedValueOnce([
      { platform: "deezer", total: 3 },
      { platform: "tidal", total: 0 },
      { platform: "bogus", total: 4 },
    ]);
    exclusions.mockResolvedValueOnce({ exclusions: [], total: 3 });
    expect(await getExclusionsByPlatform()).toEqual({
      platforms: { deezer: { exclusions: [], total: 3 } },
    });
    expect(exclusions).toHaveBeenCalledTimes(1);
    expect(exclusions).toHaveBeenCalledWith("deezer", 500);
  });
});

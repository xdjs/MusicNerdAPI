import { describe, it, expect, vi, beforeEach } from "vitest";
import { getExclusionsByPlatform } from "@/lib/agentWork/getExclusionsByPlatform";

const mock = vi.hoisted(() => ({ execute: vi.fn(), exclusions: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));
vi.mock("@/lib/mcp/getMappingExclusions", () => ({
  getMappingExclusions: mock.exclusions,
}));

beforeEach(() => vi.clearAllMocks());

describe("getExclusionsByPlatform", () => {
  it("fetches up to 500 exclusions for each valid platform that has some", async () => {
    mock.execute.mockResolvedValueOnce([
      { platform: "deezer", total: 3 },
      { platform: "legacy_platform", total: 2 },
      { platform: "wikidata", total: 0 },
    ]);
    mock.exclusions.mockResolvedValueOnce({ exclusions: [{ id: "x1" }], total: 3 });
    expect(await getExclusionsByPlatform()).toEqual({
      platforms: { deezer: { exclusions: [{ id: "x1" }], total: 3 } },
    });
    expect(mock.exclusions).toHaveBeenCalledTimes(1);
    expect(mock.exclusions).toHaveBeenCalledWith("deezer", 500);
  });

  it("is empty without exclusions, and fetches nothing", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getExclusionsByPlatform()).toEqual({ platforms: {} });
    expect(mock.exclusions).not.toHaveBeenCalled();
  });
});

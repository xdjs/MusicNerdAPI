import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect, discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { tierOneIdMappings, acceptCandidate } = vi.hoisted(() => ({
  tierOneIdMappings: vi.fn(),
  acceptCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/tierOneIdMappings", () => ({ tierOneIdMappings }));
vi.mock("@/lib/discovery/acceptCandidate", () => ({ acceptCandidate }));
const { idMappingEvents } = await import("@/lib/discovery/idMappingEvents");

beforeEach(() => {
  tierOneIdMappings.mockReset();
  acceptCandidate.mockReset();
});

describe("idMappingEvents", () => {
  it("brackets tier 1 with searching/checked and removes proposed columns from missing", async () => {
    const run = discoveryRun(["deezer", "x"]);
    const c = { tier: 1, platform: "deezer", url: "u", reasoning: "r" };
    tierOneIdMappings.mockResolvedValueOnce([c]);
    acceptCandidate.mockResolvedValueOnce({ kind: "found", profile: { siteName: "deezer" } });
    expect(await collect(idMappingEvents(run))).toEqual([
      { kind: "searching", platform: "deezer", displayName: "Deezer" },
      { kind: "found", profile: { siteName: "deezer" } },
      { kind: "checked", platform: "deezer", displayName: "Deezer" },
    ]);
    expect([...run.missing]).toEqual(["x"]);
  });

  it("yields nothing when no mapped column is missing", async () => {
    tierOneIdMappings.mockResolvedValueOnce([]);
    expect(await collect(idMappingEvents(discoveryRun(["x"])))).toEqual([]);
  });
});

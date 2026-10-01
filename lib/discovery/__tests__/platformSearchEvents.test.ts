import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect, discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { tierTwoPlatformSearchStream, acceptCandidate } = vi.hoisted(() => ({
  tierTwoPlatformSearchStream: vi.fn(),
  acceptCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/tierTwoPlatformSearchStream", () => ({ tierTwoPlatformSearchStream }));
vi.mock("@/lib/discovery/acceptCandidate", () => ({ acceptCandidate }));
const { platformSearchEvents } = await import("@/lib/discovery/platformSearchEvents");

beforeEach(() => {
  acceptCandidate.mockReset();
});

describe("platformSearchEvents", () => {
  it("announces the missing search platforms, then yields found/checked per result", async () => {
    const c = { tier: 2, platform: "spotify", url: "u", reasoning: "r" };
    tierTwoPlatformSearchStream.mockImplementationOnce(async function* () {
      yield ["spotify", c];
      yield ["deezer", null];
    });
    acceptCandidate.mockResolvedValueOnce({ kind: "found", profile: { siteName: "spotify" } });
    const run = discoveryRun(["spotify", "deezer", "x"], { deezer: "1" });
    expect(await collect(platformSearchEvents(run, "Pete Rango"))).toEqual([
      { kind: "searching", platform: "spotify", displayName: "Spotify" },
      { kind: "searching", platform: "deezer", displayName: "Deezer" },
      { kind: "found", profile: { siteName: "spotify" } },
      { kind: "checked", platform: "spotify", displayName: "Spotify" },
      { kind: "checked", platform: "deezer", displayName: "Deezer" },
    ]);
    expect(tierTwoPlatformSearchStream).toHaveBeenCalledWith("Pete Rango", run.missing, {
      deezer: "1",
    });
    expect(run.missing.has("spotify")).toBe(false);
  });
});

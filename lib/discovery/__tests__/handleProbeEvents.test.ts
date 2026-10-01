import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect, discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { tierThreeHandleProbeStream, acceptCandidate } = vi.hoisted(() => ({
  tierThreeHandleProbeStream: vi.fn(),
  acceptCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/tierThreeHandleProbeStream", () => ({ tierThreeHandleProbeStream }));
vi.mock("@/lib/discovery/acceptCandidate", () => ({ acceptCandidate }));
const { handleProbeEvents } = await import("@/lib/discovery/handleProbeEvents");

beforeEach(() => {
  acceptCandidate.mockReset();
});

describe("handleProbeEvents", () => {
  it("announces the missing handle platforms and yields found/checked per probe result", async () => {
    const c = { tier: 3, platform: "youtube", url: "u", reasoning: "r" };
    tierThreeHandleProbeStream.mockImplementationOnce(async function* () {
      yield ["youtube", c];
      yield ["x", null];
    });
    acceptCandidate.mockResolvedValueOnce(null);
    const run = discoveryRun(["spotify", "x", "youtube"]);
    const events = await collect(handleProbeEvents(run, "Pete Rango"));
    expect(
      events.filter(e => e.kind === "searching").map(e => (e as { platform: string }).platform),
    ).toEqual(["x", "youtube"]);
    expect(events.slice(2)).toEqual([
      { kind: "checked", platform: "youtube", displayName: "YouTube" },
      { kind: "checked", platform: "x", displayName: "X" },
    ]);
    expect(tierThreeHandleProbeStream.mock.calls[0][4]).toBe(run.walled);
    expect(run.missing.has("youtube")).toBe(false);
  });
});

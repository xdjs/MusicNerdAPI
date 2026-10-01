import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect, discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { tierFourWebSearchStream, propagateConfirmedHandles, acceptCandidate } = vi.hoisted(() => ({
  tierFourWebSearchStream: vi.fn(),
  propagateConfirmedHandles: vi.fn(),
  acceptCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/tierFourWebSearchStream", () => ({ tierFourWebSearchStream }));
vi.mock("@/lib/discovery/propagateConfirmedHandles", () => ({ propagateConfirmedHandles }));
vi.mock("@/lib/discovery/acceptCandidate", () => ({ acceptCandidate }));
const { webSearchEvents } = await import("@/lib/discovery/webSearchEvents");

beforeEach(() => {
  acceptCandidate.mockReset();
  propagateConfirmedHandles.mockReset();
});

describe("webSearchEvents", () => {
  it("takes the first valid result per platform and propagates its handle (without @) to what's still missing", async () => {
    const a = { tier: 4, platform: "facebook", url: "a", reasoning: "first" };
    const b = { tier: 4, platform: "facebook", url: "b", reasoning: "second" };
    tierFourWebSearchStream.mockImplementationOnce(async function* () {
      yield ["facebook", [a, b]];
      yield ["x", null];
    });
    acceptCandidate.mockImplementation(
      async (run: { missing: Set<string> }, c: { url: string; platform: string }) =>
        c.url === "a"
          ? { kind: "found", profile: { siteName: "facebook", value: "@Pete" } }
          : c.url === "p"
            ? { kind: "found", profile: { siteName: "x", value: "Pete" } }
            : null,
    );
    propagateConfirmedHandles.mockImplementationOnce(async function* () {
      yield ["x", { tier: 3, platform: "x", url: "p", reasoning: "r" }];
    });
    const run = discoveryRun(["facebook", "x"]);
    const events = await collect(webSearchEvents(run, "Pete Rango", null));
    expect(acceptCandidate.mock.calls.map(c => c[1].url)).toEqual(["a", "p"]);
    expect(propagateConfirmedHandles.mock.calls[0][0]).toEqual(new Set(["Pete"]));
    expect(propagateConfirmedHandles.mock.calls[0][1]).toEqual(["x"]);
    expect(events.filter(e => e.kind === "found")).toHaveLength(2);
    expect(run.missing.size).toBe(0);
  });

  it("does not propagate when search confirmed nothing", async () => {
    tierFourWebSearchStream.mockImplementationOnce(async function* () {
      yield ["x", []];
    });
    await collect(webSearchEvents(discoveryRun(["x"]), "Pete Rango", null));
    expect(propagateConfirmedHandles).not.toHaveBeenCalled();
  });
});

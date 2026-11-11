import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect, discoveryRun } from "@/lib/discovery/__tests__/discoveryRun";

const { tierFourWebSearchStream, acceptCandidate } = vi.hoisted(() => ({
  tierFourWebSearchStream: vi.fn(),
  acceptCandidate: vi.fn(),
}));
vi.mock("@/lib/discovery/tierFourWebSearchStream", () => ({ tierFourWebSearchStream }));
vi.mock("@/lib/discovery/acceptCandidate", () => ({ acceptCandidate }));
const { webSearchEvents } = await import("@/lib/discovery/webSearchEvents");

beforeEach(() => {
  acceptCandidate.mockReset();
});

describe("webSearchEvents", () => {
  it("takes only the first valid result per platform without fabricating other accounts", async () => {
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
    const run = discoveryRun(["facebook", "x"]);
    const events = await collect(webSearchEvents(run, "Pete Rango", null));
    expect(acceptCandidate.mock.calls.map(c => c[1].url)).toEqual(["a"]);
    expect(events.filter(e => e.kind === "found")).toHaveLength(1);
    expect(run.missing.has("x")).toBe(true);
  });

  it("does not propagate when search confirmed nothing", async () => {
    tierFourWebSearchStream.mockImplementationOnce(async function* () {
      yield ["x", []];
    });
    const events = await collect(webSearchEvents(discoveryRun(["x"]), "Pete Rango", null));
    expect(events.some(e => e.kind === "found")).toBe(false);
  });
});

it("never promotes a provisional search result into a confirmed cross-platform handle", async () => {
  tierFourWebSearchStream.mockImplementationOnce(async function* () {
    yield ["facebook", [{ tier: 4, platform: "facebook", url: "a", provisional: true }]];
  });
  acceptCandidate.mockResolvedValue({
    kind: "found",
    profile: { value: "@namesake", provisional: true },
  });
  const run = discoveryRun(["facebook", "x"]);
  await collect(webSearchEvents(run, "Nova", null));
  expect(run.missing.has("x")).toBe(true);
  expect(acceptCandidate).toHaveBeenCalledTimes(1);
});

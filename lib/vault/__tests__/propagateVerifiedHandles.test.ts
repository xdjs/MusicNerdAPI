import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({
  getAllLinks: vi.fn(),
  probe: vi.fn(),
  writeArtistLink: vi.fn(
    async (
      _a: string,
      _site: string,
      _value: string,
      _provisional?: Set<string>,
      _record?: Record<string, unknown>,
    ) => {},
  ),
}));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.getAllLinks }));
vi.mock("@/lib/vault/probeHandlesOnPlatform", () => ({ probeHandlesOnPlatform: m.probe }));
vi.mock("@/lib/vault/writeArtistLink", () => ({ writeArtistLink: m.writeArtistLink }));
const { propagateVerifiedHandles } = await import("@/lib/vault/propagateVerifiedHandles");

const row = (siteName: string, appStringFormat: string) => ({
  id: siteName,
  siteName,
  appStringFormat,
  cardPlatformName: null,
  regex: "",
});
const urlmap = [
  row("instagram", "https://instagram.com/%@"),
  row("youtube", "https://youtube.com/@%@"),
  row("soundcloud", "https://www.soundcloud.com/%@"),
  row("deezer", "deezer"),
  row("tiktok", "https://tiktok.com/@%@"),
  row("twitch", "https://twitch.tv/%@"),
  row("bandcamp", "https://%@.bandcamp.com"),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  m.getAllLinks.mockResolvedValue(urlmap);
  m.probe.mockResolvedValue({ resolved: [], scannedAll: true });
});
afterEach(() => vi.useRealTimers());

describe("propagateVerifiedHandles", () => {
  it("probes open, probe-able platforms with a handle template, writing a single answer", async () => {
    m.probe.mockImplementation(async (_a: string, platform: string) =>
      platform === "youtube"
        ? { resolved: ["p3t3rango"], scannedAll: true }
        : { resolved: [], scannedAll: true },
    );
    const provisional = new Set(["soundcloud"]);
    const artist = { instagram: "p3t3rango", soundcloud: "guess" };
    expect(
      await propagateVerifiedHandles(
        "a1",
        new Set(["p3t3rango", "ab"]),
        artist,
        "Pete Rango",
        Infinity,
        provisional,
      ),
    ).toBe(1);
    const probed = m.probe.mock.calls.map(c => c[1]);
    expect(probed).toContain("youtube");
    expect(probed).toContain("soundcloud");
    for (const skipped of ["instagram", "deezer", "tiktok", "twitch", "bandcamp"])
      expect(probed).not.toContain(skipped);
    expect(m.probe.mock.calls[0][3]).toEqual(["p3t3rango"]);
    expect(m.writeArtistLink).toHaveBeenCalledWith(
      "a1",
      "youtube",
      "p3t3rango",
      provisional,
      artist,
    );
  });

  it("leaves a platform empty on a tie or an unfinished scan", async () => {
    m.probe.mockImplementation(async (_a: string, platform: string) =>
      platform === "youtube"
        ? { resolved: ["p3t3rango", "peterango"], scannedAll: true }
        : { resolved: ["p3t3rango"], scannedAll: false },
    );
    expect(
      await propagateVerifiedHandles("a1", new Set(["p3t3rango", "peterango"]), {}, "Pete Rango"),
    ).toBe(0);
    expect(m.writeArtistLink).not.toHaveBeenCalled();
  });

  it("does nothing without a handle of three or more characters", async () => {
    expect(await propagateVerifiedHandles("a1", new Set(["ab"]), {}, "Pete Rango")).toBe(0);
    expect(m.getAllLinks).not.toHaveBeenCalled();
  });

  it("stops at the caller's deadline", async () => {
    expect(
      await propagateVerifiedHandles(
        "a1",
        new Set(["p3t3rango"]),
        {},
        "Pete Rango",
        Date.now() - 1,
      ),
    ).toBe(0);
    expect(m.probe).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.getAllLinks.mockImplementationOnce(async () => {
      throw new Error("db");
    });
    expect(await propagateVerifiedHandles("a1", new Set(["p3t3rango"]), {}, "Pete Rango")).toBe(0);
  });
});

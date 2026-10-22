import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAllLinks } = vi.hoisted(() => ({ getAllLinks: vi.fn() }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
const { getPlatformRegexesHandler } =
  await import("@/lib/platformRegexes/getPlatformRegexesHandler");

beforeEach(() => vi.clearAllMocks());

describe("getPlatformRegexesHandler", () => {
  it("returns every pattern except ens and wallets, in the envelope", async () => {
    getAllLinks.mockResolvedValue([
      { siteName: "instagram", regex: "^ig", cardPlatformName: "Instagram" },
      { siteName: "ens", regex: "^ens" },
      { siteName: "wallets", regex: "^0x" },
      { siteName: "soundcloud", regex: "^sc" },
    ]);
    const res = await getPlatformRegexesHandler();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      regexes: [
        { siteName: "instagram", regex: "^ig" },
        { siteName: "soundcloud", regex: "^sc" },
      ],
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("500s when urlmap can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getAllLinks.mockRejectedValue(new Error("db down"));
    const res = await getPlatformRegexesHandler();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not load platform patterns",
    });
    log.mockRestore();
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/db", () => ({
  db: {
    query: {
      urlmap: {
        findMany: vi.fn().mockResolvedValue([
          { siteName: "spotify", regex: "spotify\\.com" },
          { siteName: "ens", regex: "ens\\.domains" },
          { siteName: "wallets", regex: "0x.*" },
          { siteName: "youtube", regex: "youtube\\.com" },
        ]),
      },
    },
  },
}));

const { getPlatformRegexesHandler } =
  await import("@/lib/platformRegexes/getPlatformRegexesHandler");

describe("getPlatformRegexesHandler", () => {
  it("returns 200 with filtered platforms", async () => {
    const response = await getPlatformRegexesHandler();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      { siteName: "spotify", regex: "spotify\\.com" },
      { siteName: "youtube", regex: "youtube\\.com" },
    ]);
  });

  it("excludes ens and wallets", async () => {
    const response = await getPlatformRegexesHandler();
    const body = await response.json();
    expect(
      body.every((r: { siteName: string }) => r.siteName !== "ens" && r.siteName !== "wallets"),
    ).toBe(true);
  });

  it("carries CORS headers", async () => {
    const response = await getPlatformRegexesHandler();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

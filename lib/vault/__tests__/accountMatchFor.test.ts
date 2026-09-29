import { describe, it, expect, vi, beforeEach } from "vitest";

const { extractArtistId } = vi.hoisted(() => ({ extractArtistId: vi.fn() }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
const { accountMatchFor } = await import("@/lib/vault/accountMatchFor");

beforeEach(() => {
  extractArtistId.mockReset();
});

describe("accountMatchFor", () => {
  it("is an account URL for an account platform, read without its query string", async () => {
    extractArtistId.mockResolvedValue({ siteName: "x", cardPlatformName: "X", id: "p3t3rango" });
    expect(await accountMatchFor("https://x.com/p3t3rango?lang=en")).toEqual({
      match: { siteName: "x", cardPlatformName: "X", id: "p3t3rango" },
      isAccountUrl: true,
    });
    expect(extractArtistId).toHaveBeenCalledWith("https://x.com/p3t3rango");
  });

  it("counts a reference database but never an encyclopedia title or a reserved route", async () => {
    extractArtistId.mockResolvedValueOnce({
      siteName: "discogs",
      cardPlatformName: null,
      id: "123",
    });
    expect((await accountMatchFor("https://discogs.com/artist/123")).isAccountUrl).toBe(true);
    extractArtistId.mockResolvedValueOnce({
      siteName: "wikipedia",
      cardPlatformName: null,
      id: "Pete_Rango",
    });
    expect((await accountMatchFor("https://en.wikipedia.org/wiki/Pete_Rango")).isAccountUrl).toBe(
      false,
    );
    extractArtistId.mockResolvedValueOnce({
      siteName: "instagram",
      cardPlatformName: null,
      id: "p",
    });
    expect((await accountMatchFor("https://instagram.com/p/DUt")).isAccountUrl).toBe(false);
  });

  it("treats a lookup that throws as no match", async () => {
    extractArtistId.mockImplementationOnce(async () => {
      throw new Error("urlmap unavailable");
    });
    expect(await accountMatchFor("https://example.com/a")).toEqual({
      match: undefined,
      isAccountUrl: false,
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { extractArtistId } = vi.hoisted(() => ({ extractArtistId: vi.fn() }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
const { resultPassesNameCheck } = await import("@/lib/discovery/resultPassesNameCheck");

const r = (url: string, title = "") => ({ url, title, snippet: "" });

beforeEach(() => {
  extractArtistId.mockReset();
});

describe("resultPassesNameCheck", () => {
  it("passes a profile URL on the searched platform whose handle echoes the name", async () => {
    extractArtistId.mockResolvedValueOnce({
      siteName: "instagram",
      cardPlatformName: "Instagram",
      id: "p3t3rango",
    });
    expect(
      await resultPassesNameCheck(
        r("https://instagram.com/p3t3rango?hl=en", "Pete Rango (@p3t3rango)"),
        "instagram",
        "Pete Rango",
      ),
    ).toBe(true);
    expect(extractArtistId).toHaveBeenCalledWith("https://instagram.com/p3t3rango");
  });

  it("rejects non-profile URLs, Bandcamp's own subdomains, other platforms and unrelated handles", async () => {
    expect(
      await resultPassesNameCheck(r("https://instagram.com/reel/abc"), "instagram", "Pete Rango"),
    ).toBe(false);
    expect(
      await resultPassesNameCheck(r("https://blog.bandcamp.com"), "bandcamp", "Pete Rango"),
    ).toBe(false);
    extractArtistId.mockResolvedValueOnce({ siteName: "youtubechannel", id: "UC1" });
    expect(await resultPassesNameCheck(r("https://youtube.com/UC1"), "youtube", "Pete Rango")).toBe(
      false,
    );
    extractArtistId.mockResolvedValueOnce({ siteName: "instagram", id: "inoise" });
    expect(
      await resultPassesNameCheck(
        r("https://instagram.com/inoise", "Ivan Shumov"),
        "instagram",
        "Shumov",
      ),
    ).toBe(false);
  });

  it("rejects a title naming someone else, and accepts no usable title", async () => {
    extractArtistId.mockResolvedValueOnce({ siteName: "x", id: "peterango" });
    expect(
      await resultPassesNameCheck(
        r("https://x.com/peterango", "Peter Lyrøholm (@peterango)"),
        "x",
        "Pete Rango",
      ),
    ).toBe(false);
    extractArtistId.mockResolvedValueOnce({ siteName: "x", id: "peterango" });
    expect(
      await resultPassesNameCheck(r("https://x.com/peterango", "✨✨"), "x", "Pete Rango"),
    ).toBe(true);
  });

  it("is false when extractArtistId throws", async () => {
    extractArtistId.mockRejectedValueOnce(new Error("db"));
    expect(await resultPassesNameCheck(r("https://x.com/pete"), "x", "Pete")).toBe(false);
  });
});

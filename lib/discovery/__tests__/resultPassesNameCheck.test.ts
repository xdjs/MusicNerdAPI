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

  it.each(["BLACKDAVE MK2", "BLACKDAVE MK2 - X", "BLACKDAVE MK2 - X  ", "𝐁𝐋𝐀𝐂𝐊𝐃𝐀𝐕𝐄 𝐌𝐊𝟐"])(
    "accepts the reproduced Black Dave profile title: %s",
    async title => {
      extractArtistId.mockResolvedValueOnce({ siteName: "x", id: "blackdave" });
      expect(
        await resultPassesNameCheck(r("https://x.com/BlackDave", title), "x", "Black Dave MK2"),
      ).toBe(true);
    },
  );

  it.each([
    ["x", "peterango", "Peter Lyrøholm (@peterango) - X", "Pete Rango"],
    ["x", "blackdave", "BLACKDAVE MK2 X", "Black Dave MK2"],
    ["x", "blackdave", "BLACKDAVE MK2 - X fan archive", "Black Dave MK2"],
    ["instagram", "blackdave", "BLACKDAVE MK2 - X", "Black Dave MK2"],
    ["x", "someoneelse", "BLACKDAVE MK2 - X", "Black Dave MK2"],
  ] as const)(
    "does not loosen identity checks for %s/%s: %s",
    async (platform, handle, title, name) => {
      extractArtistId.mockResolvedValueOnce({ siteName: platform, id: handle });
      expect(
        await resultPassesNameCheck(
          r(`https://${platform === "x" ? "x.com" : "instagram.com"}/${handle}`, title),
          platform,
          name,
        ),
      ).toBe(false);
    },
  );

  it("is false when extractArtistId throws", async () => {
    extractArtistId.mockRejectedValueOnce(new Error("db"));
    expect(await resultPassesNameCheck(r("https://x.com/pete"), "x", "Pete")).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { URLMAP_BY_SITE } from "@/lib/discovery/__tests__/urlmapRows";

const { extractArtistId, fetchLinkPreview } = vi.hoisted(() => ({
  extractArtistId: vi.fn(),
  fetchLinkPreview: vi.fn(),
}));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview }));
const { validateCandidate } = await import("@/lib/discovery/validateCandidate");

const ctx = (record: Record<string, unknown> = {}) => ({
  record,
  urlmapBySiteName: URLMAP_BY_SITE,
  seen: new Map<string, number>(),
});

beforeEach(() => {
  extractArtistId.mockReset();
  fetchLinkPreview.mockReset().mockResolvedValue({ imageUrl: null, title: null });
});

describe("validateCandidate", () => {
  it("resolves the handle, builds the card and uses the round-tripping canonical URL", async () => {
    extractArtistId.mockResolvedValue({
      siteName: "instagram",
      cardPlatformName: "Instagram",
      id: "peterango",
    });
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: "https://cdn/p.jpg", title: null });
    expect(
      await validateCandidate(
        {
          tier: 4,
          platform: "instagram",
          url: "https://www.instagram.com/peterango/?hl=en",
          reasoning: "r",
        },
        ctx(),
      ),
    ).toEqual({
      siteName: "instagram",
      displayName: "Instagram",
      value: "peterango",
      profileUrl: "https://instagram.com/peterango",
      logoUrl: "https://cdn/instagram.png",
      colorHex: "#E1306C",
      previewImage: "https://cdn/p.jpg",
      reasoning: "r",
      provisional: false,
    });
    expect(extractArtistId.mock.calls[0][0]).toBe("https://www.instagram.com/peterango/");
  });

  it("falls back to the found URL when the canonical one doesn't round-trip", async () => {
    extractArtistId.mockImplementation(async (u: string) =>
      u === "https://twitter.com/peterango"
        ? { siteName: "x", id: "peterango" }
        : { siteName: "x", id: "ELSE" },
    );
    expect(
      (
        await validateCandidate(
          { tier: 4, platform: "x", url: "https://twitter.com/peterango", reasoning: null },
          ctx(),
        )
      )?.profileUrl,
    ).toBe("https://twitter.com/peterango");
  });

  it("drops: no id, another platform, a non-card column, a column already set, a third candidate", async () => {
    const c = { tier: 2 as const, platform: "spotify" as const, url: "u", reasoning: null };
    extractArtistId.mockResolvedValueOnce(null);
    expect(await validateCandidate(c, ctx())).toBeNull();
    extractArtistId.mockResolvedValueOnce({ siteName: "deezer", id: "1" });
    expect(await validateCandidate(c, ctx())).toBeNull();
    extractArtistId.mockResolvedValueOnce({ siteName: "youtubechannel", id: "1" });
    expect(
      await validateCandidate({ ...c, platform: "youtubechannel" as never }, ctx()),
    ).toBeNull();
    extractArtistId.mockResolvedValueOnce({ siteName: "spotify", id: "1" });
    expect(await validateCandidate(c, ctx({ spotify: "already" }))).toBeNull();
    const shared = ctx();
    extractArtistId.mockResolvedValue({ siteName: "spotify", id: "1" });
    expect(await validateCandidate(c, shared)).not.toBeNull();
    expect(await validateCandidate(c, shared)).not.toBeNull();
    expect(await validateCandidate(c, shared)).toBeNull();
  });

  it("drops a tier-4 hit on an OG-reliable platform with no image, but keeps tier 2 and non-reliable platforms", async () => {
    extractArtistId.mockResolvedValue({ siteName: "instagram", id: "p" });
    expect(
      await validateCandidate(
        { tier: 4, platform: "instagram", url: "https://instagram.com/p", reasoning: null },
        ctx(),
      ),
    ).toBeNull();
    extractArtistId.mockResolvedValue({ siteName: "spotify", id: "real123" });
    expect(
      await validateCandidate(
        {
          tier: 2,
          platform: "spotify",
          url: "https://open.spotify.com/artist/real123",
          reasoning: null,
        },
        ctx(),
      ),
    ).toMatchObject({
      previewImage: null,
    });
    extractArtistId.mockResolvedValue({ siteName: "x", id: "p" });
    expect(
      await validateCandidate(
        { tier: 4, platform: "x", url: "https://x.com/p", reasoning: null },
        ctx(),
      ),
    ).not.toBeNull();
  });

  it("reuses a probe's preview instead of fetching again, and survives extractArtistId throwing", async () => {
    extractArtistId.mockResolvedValue({ siteName: "youtube", id: "p" });
    await validateCandidate(
      {
        tier: 3,
        platform: "youtube",
        url: "https://youtube.com/@p",
        reasoning: null,
        preview: { imageUrl: "i", title: "t" },
        provisional: true,
      },
      ctx(),
    );
    expect(fetchLinkPreview).not.toHaveBeenCalled();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    extractArtistId.mockRejectedValueOnce(new Error("db"));
    expect(
      await validateCandidate({ tier: 4, platform: "x", url: "u", reasoning: null }, ctx()),
    ).toBeNull();
    error.mockRestore();
  });
});

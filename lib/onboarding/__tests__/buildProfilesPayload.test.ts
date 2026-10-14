import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  getAllLinks: vi.fn(),
  previews: vi.fn(),
  platform: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.getArtistById }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.getAllLinks }));
vi.mock("@/lib/onboarding/gatherProfilePreviews", () => ({ gatherProfilePreviews: m.previews }));
vi.mock("@/lib/musicPlatform/getArtistPlatformData", () => ({ getArtistPlatformData: m.platform }));
const { buildProfilesPayload } = await import("@/lib/onboarding/buildProfilesPayload");

beforeEach(() => {
  m.getArtistById.mockReset().mockResolvedValue({
    id: "a1",
    name: "Nova Reyes",
    spotify: "spot1",
    instagram: "nova",
    bio: "x",
  });
  m.getAllLinks.mockReset().mockResolvedValue([
    {
      siteName: "instagram",
      cardPlatformName: "Instagram",
      siteImage: "logo",
      colorHex: "#E1306C",
      appStringFormat: "https://instagram.com/%@",
    },
  ]);
  m.previews.mockReset().mockResolvedValue(new Map([["instagram", "https://img"]]));
  m.platform.mockReset().mockResolvedValue({
    platform: "spotify",
    followerCount: 10,
    imageUrl: "https://p",
    name: "Nova",
  });
});

describe("buildProfilesPayload", () => {
  it("lists the artist's links with presentation, previews and enrichment", async () => {
    const payload = await buildProfilesPayload("a1");
    expect(payload.artistName).toBe("Nova Reyes");
    expect(payload.enrichment).toEqual({
      platform: "spotify",
      followerCount: 10,
      imageUrl: "https://p",
    });
    const ig = payload.links.find(l => l.siteName === "instagram");
    expect(ig).toEqual({
      siteName: "instagram",
      value: "nova",
      displayName: "Instagram",
      logoUrl: "logo",
      colorHex: "#E1306C",
      profileUrl: "https://instagram.com/nova",
      previewImage: "https://img",
    });
    expect(m.previews).toHaveBeenCalledWith(
      expect.arrayContaining([["instagram", "https://instagram.com/nova"]]),
    );
  });

  it("degrades to bare links when urlmap can't be read, and to no enrichment on failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.getAllLinks.mockRejectedValueOnce(new Error("pool"));
    m.platform.mockRejectedValueOnce(new Error("spotify"));
    const payload = await buildProfilesPayload("a1");
    expect(payload.links).toContainEqual({ siteName: "instagram", value: "nova" });
    expect(payload.enrichment).toBeNull();
    error.mockRestore();
  });

  it("throws for a missing artist", async () => {
    m.getArtistById.mockResolvedValueOnce(undefined);
    await expect(buildProfilesPayload("a1")).rejects.toThrow("Artist not found: a1");
  });

  it("includes the saved YouTube channel without treating it as a handle or changing its removal key", async () => {
    m.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Nova Reyes",
      deezer: "65660322",
      youtube: null,
      youtubechannel: "UCexample",
    });
    m.getAllLinks.mockResolvedValueOnce([
      { siteName: "deezer", cardPlatformName: "Deezer", appStringFormat: "deezer" },
      {
        siteName: "youtube",
        cardPlatformName: "YouTube",
        siteImage: "youtube-logo",
        appStringFormat: "https://youtube.com/@%@",
      },
    ]);
    const payload = await buildProfilesPayload("a1");
    expect(payload.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          siteName: "deezer",
          profileUrl: "https://www.deezer.com/artist/65660322",
        }),
        expect.objectContaining({
          siteName: "youtubechannel",
          value: "UCexample",
          displayName: "YouTube",
          logoUrl: "youtube-logo",
          profileUrl: "https://www.youtube.com/channel/UCexample",
        }),
      ]),
    );
    expect(payload.links.some(l => l.siteName === "youtube")).toBe(false);
    expect(m.previews).toHaveBeenCalledWith(
      expect.arrayContaining([
        ["deezer", "https://www.deezer.com/artist/65660322"],
        ["youtubechannel", "https://www.youtube.com/channel/UCexample"],
      ]),
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { spotify, og } = vi.hoisted(() => ({ spotify: vi.fn(), og: vi.fn() }));
vi.mock("@/lib/pages/fetchSpotifyPreview", () => ({ fetchSpotifyPreview: spotify }));
vi.mock("@/lib/pages/fetchOgPreview", () => ({ fetchOgPreview: og }));
const { fetchLinkPreview } = await import("@/lib/pages/fetchLinkPreview");

const EMPTY = { imageUrl: null, title: null };

beforeEach(() => {
  spotify.mockReset().mockResolvedValue({ imageUrl: "s", title: "S" });
  og.mockReset().mockResolvedValue({ imageUrl: "o", title: "O" });
});

describe("fetchLinkPreview", () => {
  it("returns nulls for an empty or unsafe URL without fetching", async () => {
    expect(await fetchLinkPreview("")).toEqual(EMPTY);
    expect(await fetchLinkPreview("http://169.254.169.254/latest/meta-data")).toEqual(EMPTY);
    expect(spotify).not.toHaveBeenCalled();
    expect(og).not.toHaveBeenCalled();
  });

  it("routes Spotify to oEmbed-first and everything else to the scrape", async () => {
    expect(await fetchLinkPreview("https://open.spotify.com/artist/1")).toEqual({
      imageUrl: "s",
      title: "S",
    });
    expect(await fetchLinkPreview("https://instagram.com/nova")).toEqual({
      imageUrl: "o",
      title: "O",
    });
  });

  it("never throws", async () => {
    og.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    expect(await fetchLinkPreview("https://example.com/artist")).toEqual(EMPTY);
  });
});

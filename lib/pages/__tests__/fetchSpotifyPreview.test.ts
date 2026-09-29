import { describe, it, expect, vi, beforeEach } from "vitest";

const { oembed, og } = vi.hoisted(() => ({ oembed: vi.fn(), og: vi.fn() }));
vi.mock("@/lib/pages/fetchSpotifyOEmbed", () => ({ fetchSpotifyOEmbed: oembed }));
vi.mock("@/lib/pages/fetchOgPreview", () => ({ fetchOgPreview: og }));
const { fetchSpotifyPreview } = await import("@/lib/pages/fetchSpotifyPreview");

beforeEach(() => {
  oembed.mockReset();
  og.mockReset();
});

describe("fetchSpotifyPreview", () => {
  it("uses oEmbed when it has an image, without scraping", async () => {
    oembed.mockResolvedValue({ imageUrl: "https://i/a.jpg", title: "Nova" });
    expect(await fetchSpotifyPreview("u")).toEqual({ imageUrl: "https://i/a.jpg", title: "Nova" });
    expect(og).not.toHaveBeenCalled();
  });

  it("falls back to the scrape, keeping oEmbed's title when the scrape has none", async () => {
    oembed.mockResolvedValue({ imageUrl: null, title: "Nova" });
    og.mockResolvedValue({ imageUrl: "https://i/s.jpg", title: null });
    expect(await fetchSpotifyPreview("u")).toEqual({ imageUrl: "https://i/s.jpg", title: "Nova" });
  });
});

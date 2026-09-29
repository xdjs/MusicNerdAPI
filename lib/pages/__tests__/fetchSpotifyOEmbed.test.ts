import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSpotifyOEmbed } from "@/lib/pages/fetchSpotifyOEmbed";

afterEach(() => vi.unstubAllGlobals());

describe("fetchSpotifyOEmbed", () => {
  it("returns the https thumbnail and title from the oEmbed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ thumbnail_url: "https://i.scdn.co/image/abc", title: "Nova" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchSpotifyOEmbed("https://open.spotify.com/artist/1")).toEqual({
      imageUrl: "https://i.scdn.co/image/abc",
      title: "Nova",
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fartist%2F1",
    );
  });

  it("drops a non-https thumbnail and degrades every failure to nulls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ thumbnail_url: "http://x" }) })),
    );
    expect(await fetchSpotifyOEmbed("https://open.spotify.com/a")).toEqual({
      imageUrl: null,
      title: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    expect(await fetchSpotifyOEmbed("https://open.spotify.com/a")).toEqual({
      imageUrl: null,
      title: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("bad json");
        },
      })),
    );
    expect(await fetchSpotifyOEmbed("https://open.spotify.com/a")).toEqual({
      imageUrl: null,
      title: null,
    });
  });
});

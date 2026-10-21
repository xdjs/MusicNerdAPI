import { afterEach, describe, expect, it, vi } from "vitest";
import { deezerTrackLink } from "@/lib/trackLinks/deezerTrackLink";

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }));
afterEach(() => vi.unstubAllGlobals());

describe("deezerTrackLink", () => {
  it("returns the matching track", async () => {
    const fetchMock = answer({
      data: [
        {
          title: "Rush",
          link: "https://www.deezer.com/track/1",
          artist: { name: "Dame Atlas & Pete Rango" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await deezerTrackLink("Rush", "Pete Rango", false)).toEqual({
      service: "Deezer",
      url: "https://www.deezer.com/track/1",
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toMatch(
      /api\.deezer\.com\/search\?q=/,
    );
  });

  it("searches albums on the album endpoint", async () => {
    const fetchMock = answer({ data: [] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await deezerTrackLink("LP", "Pete Rango", true)).toBeNull();
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/search/album?q=");
  });

  it("is undefined when Deezer could not be searched", async () => {
    vi.stubGlobal("fetch", answer({}, false));
    expect(await deezerTrackLink("Rush", "Pete Rango", false)).toBeUndefined();
  });
});

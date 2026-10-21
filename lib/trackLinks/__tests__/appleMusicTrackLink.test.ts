import { afterEach, describe, expect, it, vi } from "vitest";
import { appleMusicTrackLink } from "@/lib/trackLinks/appleMusicTrackLink";

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }));
afterEach(() => vi.unstubAllGlobals());

describe("appleMusicTrackLink", () => {
  it("returns the matching song without Apple's query string", async () => {
    const fetchMock = answer({
      results: [
        {
          trackName: "Other",
          artistName: "Pete Rango",
          trackViewUrl: "https://music.apple.com/x?uo=4",
        },
        {
          trackName: "Rush",
          artistName: "Pete Rango",
          trackViewUrl: "https://music.apple.com/rush?uo=4",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await appleMusicTrackLink("Rush", "Pete Rango", false)).toEqual({
      service: "Apple Music",
      url: "https://music.apple.com/rush",
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("entity=song");
  });

  it("searches albums by collection", async () => {
    const fetchMock = answer({
      results: [
        {
          collectionName: "LP",
          artistName: "Pete Rango",
          collectionViewUrl: "https://music.apple.com/lp",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await appleMusicTrackLink("LP", "Pete Rango", true)).toEqual({
      service: "Apple Music",
      url: "https://music.apple.com/lp",
    });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("entity=album");
  });

  it("is null for no match and undefined when Apple could not be searched", async () => {
    vi.stubGlobal(
      "fetch",
      answer({ results: [{ trackName: "Rush", artistName: "Dave East", trackViewUrl: "u" }] }),
    );
    expect(await appleMusicTrackLink("Rush", "Dave", false)).toBeNull();
    vi.stubGlobal("fetch", answer({}, false));
    expect(await appleMusicTrackLink("Rush", "Dave", false)).toBeUndefined();
  });
});

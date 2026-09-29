import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSpotifyCatalogNames } from "@/lib/spotify/getSpotifyCatalogNames";

const fetchMock = vi.fn();
const headers = { headers: { Authorization: "Bearer tok" } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("getSpotifyCatalogNames", () => {
  it("returns up to 15 distinct release names and 8 top tracks", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/albums")
        ? json({
            items: [
              ...Array.from({ length: 20 }, (_, i) => ({ name: `R${i}` })),
              { name: "R0" },
              {},
            ],
          })
        : json({ tracks: [...Array.from({ length: 10 }, (_, i) => ({ name: `T${i}` })), {}] }),
    );
    const out = await getSpotifyCatalogNames("abc", headers);
    expect(out.releases).toEqual(Array.from({ length: 15 }, (_, i) => `R${i}`));
    expect(out.topTracks).toEqual(Array.from({ length: 8 }, (_, i) => `T${i}`));
    const urls = fetchMock.mock.calls.map(c => c[0]);
    expect(urls).toContain(
      "https://api.spotify.com/v1/artists/abc/albums?include_groups=album%2Csingle&limit=20&market=US",
    );
    expect(urls).toContain("https://api.spotify.com/v1/artists/abc/top-tracks?market=US");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("keeps whichever half succeeded", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/albums") ? json({}, 429) : json({ tracks: [{ name: "T" }] }),
    );
    expect(await getSpotifyCatalogNames("abc", headers)).toEqual({
      releases: [],
      topTracks: ["T"],
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/top-tracks")) throw new Error("down");
      return json({ items: [{ name: "R" }] });
    });
    expect(await getSpotifyCatalogNames("abc", headers)).toEqual({
      releases: ["R"],
      topTracks: [],
    });
  });

  it("returns empty lists with no id", async () => {
    expect(await getSpotifyCatalogNames(null, headers)).toEqual({ releases: [], topTracks: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

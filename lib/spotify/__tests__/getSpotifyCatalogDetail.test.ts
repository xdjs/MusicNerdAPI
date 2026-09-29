import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSpotifyCatalogDetail } from "@/lib/spotify/getSpotifyCatalogDetail";

const fetchMock = vi.fn();
const headers = { headers: { Authorization: "Bearer tok" } };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("getSpotifyCatalogDetail", () => {
  it("returns releases deduped by name, newest first", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              name: "Old",
              release_date: "2019-01-01",
              album_group: "album",
              external_urls: { spotify: "s1" },
            },
            { name: "New", release_date: "2026-03-01", album_group: "single" },
            { name: "old", release_date: "2020-01-01" },
            { release_date: "2021-01-01" },
          ],
        }),
      ),
    );
    expect(await getSpotifyCatalogDetail("abc", headers)).toEqual([
      { name: "New", releaseDate: "2026-03-01", kind: "single", url: null },
      { name: "Old", releaseDate: "2019-01-01", kind: "album", url: "s1" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.spotify.com/v1/artists/abc/albums?include_groups=album%2Csingle%2Cappears_on&limit=50&market=US",
    );
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("returns [] with no id, on an HTTP error, and on a network error", async () => {
    expect(await getSpotifyCatalogDetail(null, headers)).toEqual([]);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect(await getSpotifyCatalogDetail("abc", headers)).toEqual([]);
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    expect(await getSpotifyCatalogDetail("abc", headers)).toEqual([]);
  });
});

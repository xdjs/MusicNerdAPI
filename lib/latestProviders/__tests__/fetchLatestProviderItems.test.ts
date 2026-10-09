import { afterEach, expect, it, vi } from "vitest";
import { fetchLatestProviderItems } from "../fetchLatestProviderItems";
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({
  getSpotifyHeaders: vi.fn(async () => ({ headers: { Authorization: "Bearer fixture" } })),
}));
afterEach(() => vi.unstubAllGlobals());
it("fetches one bounded known-ID catalog and never follows redirects", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchLatestProviderItems("deezer", "123")).toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    "https://api.deezer.com/artist/123/albums?limit=50",
    expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }),
  );
});
it("rejects invalid account IDs before fetching and surfaces invalid/failed responses", async () => {
  const fetch = vi.fn(async () => new Response("oops", { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchLatestProviderItems("deezer", "../other")).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  await expect(fetchLatestProviderItems("deezer", "123")).rejects.toThrow();
});

it("bounds the response body before parsing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("x".repeat(2_000_001))),
  );
  await expect(fetchLatestProviderItems("deezer", "123")).rejects.toThrow("body exceeds budget");
});

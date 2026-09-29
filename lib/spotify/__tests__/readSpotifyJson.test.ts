import { describe, it, expect, vi, afterEach } from "vitest";
import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";

afterEach(() => vi.unstubAllGlobals());
const headers = { headers: { Authorization: "Bearer tok" } };

describe("readSpotifyJson", () => {
  it("GETs with the bearer headers and parses the body", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ a: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readSpotifyJson("https://api.spotify.com/v1/x", headers)).toEqual({ a: 1 });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({
      Authorization: "Bearer tok",
    });
  });

  it("throws on a non-2xx status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    await expect(readSpotifyJson("https://api.spotify.com/v1/x", headers)).rejects.toThrow(
      "Spotify returned 429",
    );
  });
});

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

  it("uses a caller's transport when given one", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const transport = vi.fn(async () => new Response(JSON.stringify({ b: 2 })));
    expect(await readSpotifyJson("https://api.spotify.com/v1/x", headers, transport)).toEqual({
      b: 2,
    });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
it("passes cancellation to the catalog transport and refuses work after cancellation", async () => {
  const controller = new AbortController();
  const transport = vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.signal).toBe(controller.signal);
    return new Response("{}");
  });
  await readSpotifyJson("https://api.spotify.com/v1/x", headers, transport, controller.signal);
  controller.abort(new Error("deadline"));
  await expect(
    readSpotifyJson("https://api.spotify.com/v1/x", headers, transport, controller.signal),
  ).rejects.toThrow("deadline");
  expect(transport).toHaveBeenCalledTimes(1);
});

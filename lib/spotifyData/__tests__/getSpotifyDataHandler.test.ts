import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";

const { getSpotifyHeaders, one, many } = vi.hoisted(() => ({
  getSpotifyHeaders: vi.fn(),
  one: vi.fn(),
  many: vi.fn(),
}));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
vi.mock("@/lib/spotifyData/getSpotifyArtistData", () => ({ getSpotifyArtistData: one }));
vi.mock("@/lib/spotifyData/getSpotifyArtistsData", () => ({ getSpotifyArtistsData: many }));
const { getSpotifyDataHandler } = await import("@/lib/spotifyData/getSpotifyDataHandler");
const { spotifyArtistCache } = await import("@/lib/spotifyData/const");

const headers = { headers: { Authorization: "Bearer t" } };
const get = (query: string) =>
  getSpotifyDataHandler(new Request(`https://api.test/api/getSpotifyData${query}`));

beforeEach(() => {
  vi.useRealTimers();
  spotifyArtistCache.clear();
  getSpotifyHeaders.mockReset().mockResolvedValue(headers);
  one.mockReset();
  many.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSpotifyDataHandler", () => {
  it("returns one artist as { data }, with CORS", async () => {
    one.mockResolvedValueOnce({ data: { id: "a", name: "A" }, error: null });
    const r = await get("?spotifyId=a");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: { id: "a", name: "A" } });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(one).toHaveBeenCalledWith("a", headers);
  });

  it("returns a Spotify failure as 502 with its message and no-store", async () => {
    one.mockResolvedValueOnce({ data: null, error: "Invalid Spotify ID" });
    const r = await get("?spotifyId=bad");
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "Invalid Spotify ID" });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a retryable 503 when the token is blocked by the shared cooldown, then recovers", async () => {
    getSpotifyHeaders.mockRejectedValueOnce(new SpotifyDeferredError(Date.now() + 60_000));
    const r = await get("?spotifyId=fixture");
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({
      error: "Spotify is temporarily rate limited. Please try again later.",
    });
    expect(one).not.toHaveBeenCalled();
    one.mockResolvedValueOnce({ data: { id: "fixture", name: "Recovered" }, error: null });
    const recovered = await get("?spotifyId=fixture");
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ data: { name: "Recovered" } });
  });

  it("returns any other failure as 502 Failed to fetch artist data", async () => {
    getSpotifyHeaders.mockRejectedValueOnce(new Error("Spotify credentials not configured"));
    const r = await get("?spotifyId=a");
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "Failed to fetch artist data" });
  });

  it("returns a batch as { data: [...] }, and 502 when it fails", async () => {
    many.mockResolvedValueOnce([{ id: "a" }, null]);
    const r = await get("?spotifyIds=a,b");
    expect(await r.json()).toEqual({ data: [{ id: "a" }, null] });
    expect(many).toHaveBeenCalledWith(["a", "b"], headers);
    many.mockRejectedValueOnce(new Error("Spotify returned 500"));
    const failed = await get("?spotifyIds=a,b");
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "Failed to fetch artist data" });
  });

  it("keeps a successful single answer for 24 hours, without asking for a token", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T00:00:00Z") });
    one.mockResolvedValueOnce({ data: { id: "a", name: "A" }, error: null });
    await get("?spotifyId=a");
    const cached = await get("?spotifyId=a");
    expect(await cached.json()).toEqual({ data: { id: "a", name: "A" } });
    expect(one).toHaveBeenCalledTimes(1);
    expect(getSpotifyHeaders).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-22T00:00:01Z"));
    one.mockResolvedValueOnce({ data: { id: "a", name: "A2" }, error: null });
    expect(await (await get("?spotifyId=a")).json()).toEqual({ data: { id: "a", name: "A2" } });
    expect(one).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed single answer or a batch", async () => {
    one.mockResolvedValueOnce({ data: null, error: "Invalid Spotify ID" });
    await get("?spotifyId=a");
    one.mockResolvedValueOnce({ data: { id: "a", name: "A" }, error: null });
    expect((await get("?spotifyId=a")).status).toBe(200);
    many.mockResolvedValue([{ id: "a" }]);
    await get("?spotifyIds=a");
    await get("?spotifyIds=a");
    expect(many).toHaveBeenCalledTimes(2);
  });

  it("answers 400 without an id", async () => {
    expect((await get("")).status).toBe(400);
  });
});

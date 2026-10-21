import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSpotifyHeaders, many } = vi.hoisted(() => ({
  getSpotifyHeaders: vi.fn(),
  many: vi.fn(),
}));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
vi.mock("@/lib/spotifyData/getSpotifyArtistsData", () => ({ getSpotifyArtistsData: many }));
const { postSpotifyDataHandler } = await import("@/lib/spotifyData/postSpotifyDataHandler");

const headers = { headers: { Authorization: "Bearer t" } };
const post = (body: string) =>
  postSpotifyDataHandler(
    new Request("https://api.test/api/getSpotifyData", { method: "POST", body }),
  );

beforeEach(() => {
  getSpotifyHeaders.mockReset().mockResolvedValue(headers);
  many.mockReset();
  vi.useRealTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("postSpotifyDataHandler", () => {
  it("returns the batch as { data }, de-duplicated and trimmed, with CORS", async () => {
    many.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    const r = await post('{"spotifyIds":[" a ","b","a"]}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: [{ id: "a" }, { id: "b" }] });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(many).toHaveBeenCalledWith(["a", "b"], headers);
  });

  it("answers 400 for a bad list and 500 for a non-JSON body or a Spotify failure", async () => {
    expect((await post("{}")).status).toBe(400);
    const r = await post("nope");
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "Internal server error" });
    many.mockRejectedValueOnce(new Error("Spotify returned 500"));
    expect((await post('{"spotifyIds":["a"]}')).status).toBe(500);
  });

  it("answers 408 when Spotify outlives 12 seconds", async () => {
    vi.useFakeTimers();
    many.mockReturnValueOnce(new Promise(() => {}));
    const pending = post('{"spotifyIds":["a"]}');
    await vi.advanceTimersByTimeAsync(12_000);
    const r = await pending;
    expect(r.status).toBe(408);
    expect(await r.json()).toEqual({ error: "Request timed out" });
  });
});

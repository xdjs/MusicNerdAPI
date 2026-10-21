import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchArtistsCache } from "@/lib/artistSearch/const";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/artistSearch/searchArtists", () => ({ searchArtists: search }));
const { postSearchArtistsHandler } = await import("@/lib/artistSearch/postSearchArtistsHandler");

const post = (body: string) =>
  postSearchArtistsHandler(
    new Request("https://api.test/api/searchArtists", { method: "POST", body }),
  );

beforeEach(() => {
  search.mockReset();
  searchArtistsCache.clear();
  vi.useRealTimers();
});

describe("postSearchArtistsHandler", () => {
  it("answers { results } with CORS and serves the same search from memory for 5 minutes", async () => {
    search.mockResolvedValueOnce([{ id: "a1" }]);
    const r = await post('{"query":"pete","bookmarkedArtistIds":["b","a"]}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ results: [{ id: "a1" }] });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(search).toHaveBeenCalledWith("pete", ["b", "a"]);
    const again = await post('{"query":"pete","bookmarkedArtistIds":["a","b"]}');
    expect(await again.json()).toEqual({ results: [{ id: "a1" }] });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("answers 400 for a bad query and 500 for a body that is not JSON", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post("{}")).status).toBe(400);
    const r = await post("not json");
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "Internal server error" });
    error.mockRestore();
  });

  it("answers 408 when the search outlives 12 seconds, and 500 when it fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    search.mockReturnValueOnce(new Promise(() => {}));
    const pending = post('{"query":"slow"}');
    await vi.advanceTimersByTimeAsync(12_000);
    const r = await pending;
    expect(r.status).toBe(408);
    expect(await r.json()).toEqual({
      error: "Search timed out. Please try a more specific search term.",
    });
    vi.useRealTimers();
    search.mockRejectedValueOnce(new Error("db"));
    expect((await post('{"query":"boom"}')).status).toBe(500);
    error.mockRestore();
  });
});

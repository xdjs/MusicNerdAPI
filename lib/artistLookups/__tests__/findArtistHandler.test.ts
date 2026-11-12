import { beforeEach, describe, expect, it, vi } from "vitest";

const { find, publicBio } = vi.hoisted(() => ({ find: vi.fn(), publicBio: vi.fn() }));
vi.mock("@/lib/bio/getPublicSavedBio", () => ({ getPublicSavedBio: publicBio }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({
  getPublicArtistAbout: vi.fn(async () => null),
}));
vi.mock("@/lib/artistLookups/findArtistByColumn", () => ({ findArtistByColumn: find }));
const { findArtistHandler } = await import("@/lib/artistLookups/findArtistHandler");
const { lookupArtists } = await import("@/lib/artistLookups/lookupArtists");

const MISSING = "Missing or invalid required parameters: spotifyID";
const post = (body: string) =>
  new Request("https://api.test/api/findArtistBySpotifyID", { method: "POST", body });
const run = (body: string) =>
  findArtistHandler(post(body), "spotifyID", lookupArtists.spotify, MISSING);

beforeEach(() => {
  vi.clearAllMocks();
  publicBio.mockResolvedValue(null);
});

describe("findArtistHandler", () => {
  it("answers 200 { result: row } for a match, with CORS", async () => {
    find.mockResolvedValueOnce({ id: "a1", spotify: "sp1" });
    const r = await run('{"spotifyID":"sp1"}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ result: { id: "a1", spotify: "sp1", bio: null } });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(find).toHaveBeenCalledWith(lookupArtists.spotify, "sp1");
  });

  it("answers 404 with MusicNerdWeb's plain-text message when nothing matches", async () => {
    find.mockResolvedValueOnce(undefined);
    const r = await run('{"spotifyID":"nobody"}');
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("The artist you're searching for is not found");
  });

  it("answers 400 with MusicNerdWeb's message for a missing, non-string or non-JSON value", async () => {
    for (const body of ["{}", '{"spotifyID":5}', "not json", "null"]) {
      const r = await run(body);
      expect(r.status).toBe(400);
      expect(await r.text()).toBe(MISSING);
    }
    expect(find).not.toHaveBeenCalled();
  });

  it("answers 500, not 404, when the database fails", async () => {
    find.mockRejectedValueOnce(new Error("secret SQL"));
    const r = await run('{"spotifyID":"sp1"}');
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("Something went wrong on our end");
  });
});

it("does not leak a hidden generated About through exact-match lookups", async () => {
  find.mockResolvedValueOnce({ id: "a1", bio: "PRIVATE generated About" });
  expect(await (await run('{"spotifyID":"sp1"}')).json()).toEqual({
    result: { id: "a1", bio: null },
  });
  publicBio.mockResolvedValueOnce("Current public About");
  find.mockResolvedValueOnce({ id: "a1", bio: "STALE" });
  expect(await (await run('{"spotifyID":"sp1"}')).json()).toEqual({
    result: { id: "a1", bio: "Current public About" },
  });
});

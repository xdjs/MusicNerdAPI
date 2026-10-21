import { describe, expect, it } from "vitest";
import { validateSearchArtistsBody } from "@/lib/artistSearch/validateSearchArtistsBody";
import { validateSearchArtistsBatchBody } from "@/lib/artistSearch/validateSearchArtistsBatchBody";

describe("validateSearchArtistsBody", () => {
  it("returns the query and bookmarks, defaulting bookmarks to none", () => {
    expect(validateSearchArtistsBody({ query: "pete", bookmarkedArtistIds: ["a"] })).toEqual({
      query: "pete",
      bookmarkedArtistIds: ["a"],
    });
    expect(validateSearchArtistsBody({ query: "pete" })).toEqual({
      query: "pete",
      bookmarkedArtistIds: [],
    });
    expect(validateSearchArtistsBody({ query: "pete", bookmarkedArtistIds: "a" })).toEqual({
      query: "pete",
      bookmarkedArtistIds: [],
    });
  });

  it("answers 400 with MusicNerdWeb's message for a missing, empty or non-string query", async () => {
    for (const body of [{}, { query: "" }, { query: 5 }, null]) {
      const r = validateSearchArtistsBody(body) as Response;
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: "Invalid query parameter" });
    }
  });
});

describe("validateSearchArtistsBatchBody", () => {
  it("returns the trimmed, de-duplicated names from artists, else the one artist", () => {
    expect(validateSearchArtistsBatchBody({ query: { artists: [" a ", "b", "a", ""] } })).toEqual([
      "a",
      "b",
    ]);
    expect(validateSearchArtistsBatchBody({ query: { artist: " solo " } })).toEqual(["solo"]);
    expect(validateSearchArtistsBatchBody({ query: { artists: "nope", artist: "solo" } })).toEqual([
      "solo",
    ]);
  });

  it("answers 400 with MusicNerdWeb's message when no name is left", async () => {
    for (const body of [{}, { query: {} }, { query: { artists: [" "] } }, null]) {
      const r = validateSearchArtistsBatchBody(body) as Response;
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: "No queries provided" });
    }
  });
});

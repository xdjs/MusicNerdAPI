import { describe, expect, it } from "vitest";
import { validateSearchArtistsBody } from "@/lib/artistSearch/validateSearchArtistsBody";

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

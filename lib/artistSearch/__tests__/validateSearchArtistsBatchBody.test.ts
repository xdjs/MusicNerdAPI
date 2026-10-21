import { describe, expect, it } from "vitest";
import { validateSearchArtistsBatchBody } from "@/lib/artistSearch/validateSearchArtistsBatchBody";

describe("validateSearchArtistsBatchBody", () => {
  it("returns query.artists trimmed and de-duplicated", () => {
    expect(validateSearchArtistsBatchBody({ query: { artists: [" A ", "B", "A", " "] } })).toEqual([
      "A",
      "B",
    ]);
  });

  it("falls back to the one query.artist", () => {
    expect(validateSearchArtistsBatchBody({ query: { artist: " A " } })).toEqual(["A"]);
  });

  it("answers 400 No queries provided when no name is left", async () => {
    for (const body of [{}, { query: { artists: [] } }, { query: { artist: 3 } }, null]) {
      const res = validateSearchArtistsBatchBody(body) as Response;
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "No queries provided" });
    }
  });
});

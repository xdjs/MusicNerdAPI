import { describe, it, expect } from "vitest";
import { artistRow } from "@/lib/mcp/__tests__/artistRow";
import { toArtistSummary } from "@/lib/mcp/toArtistSummary";

describe("toArtistSummary", () => {
  it("returns only the id and name", () => {
    const artist = artistRow({
      id: "abc",
      name: "Daft Punk",
      bio: "b",
      spotify: "s",
      instagram: "i",
    });
    expect(toArtistSummary(artist)).toEqual({ id: "abc", name: "Daft Punk" });
  });

  it("turns a null name into an empty string", () => {
    expect(toArtistSummary(artistRow({ id: "xyz", name: null }))).toEqual({ id: "xyz", name: "" });
  });
});

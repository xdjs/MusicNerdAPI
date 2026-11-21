import { describe, it, expect } from "vitest";
import { dedupeAddArtistCandidates } from "@/lib/addArtist/dedupeAddArtistCandidates";

describe("dedupeAddArtistCandidates", () => {
  it("keeps one candidate per artist id", () => {
    const a = { id: "a", name: "A", spotify: null, deezer: null };
    const b = { id: "b", name: "B", spotify: null, deezer: null };
    expect(dedupeAddArtistCandidates([a, b, a])).toEqual([a, b]);
  });
});

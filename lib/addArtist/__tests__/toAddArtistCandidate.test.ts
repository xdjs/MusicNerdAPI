import { describe, it, expect } from "vitest";
import { toAddArtistCandidate } from "@/lib/addArtist/toAddArtistCandidate";

describe("toAddArtistCandidate", () => {
  it("keeps id, name and catalog ids, and the image only when uploaded", () => {
    const row = { id: "a1", name: "R", spotify: "s", deezer: null };
    expect(toAddArtistCandidate({ ...row, customImage: " " })).toEqual(row);
    expect(toAddArtistCandidate({ ...row, customImage: "https://img" })).toEqual({
      imageUrl: "https://img",
      ...row,
    });
  });
});

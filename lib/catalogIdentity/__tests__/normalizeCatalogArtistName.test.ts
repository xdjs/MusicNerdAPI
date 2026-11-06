import { describe, it, expect } from "vitest";
import { normalizeCatalogArtistName } from "@/lib/catalogIdentity/normalizeCatalogArtistName";

describe("normalizeCatalogArtistName", () => {
  it("folds accents, punctuation, a leading 'the' and a featured artist", () => {
    expect(normalizeCatalogArtistName("The Beatles")).toBe("beatles");
    expect(normalizeCatalogArtistName("Sigur Rós")).toBe("sigur ros");
    expect(normalizeCatalogArtistName("AC/DC feat. Someone")).toBe("ac dc");
    expect(normalizeCatalogArtistName("  !!  ")).toBe("");
  });
});

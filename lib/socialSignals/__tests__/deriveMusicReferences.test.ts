import { describe, it, expect } from "vitest";
import { deriveMusicReferences } from "@/lib/socialSignals/deriveMusicReferences";
import { nameTokens } from "@/lib/socialSignals/nameTokens";
import { post } from "@/lib/socialSignals/__tests__/post";

const pete = nameTokens("Pete Rango");

describe("deriveMusicReferences", () => {
  it("drops a track credited to somebody else and keeps the artist's own, citing only its post", () => {
    const refs = deriveMusicReferences(
      [
        post({ url: "empanadas", musicTitle: "Las Empanadas", musicArtist: "Los Caracuchos" }),
        post({ url: "leash", musicTitle: "OFF THE LEASH", musicArtist: "LIL LIL, Pete Rango" }),
        post({ url: "other", musicTitle: null, musicArtist: null }),
      ],
      pete,
    );
    expect(refs).toEqual([
      {
        title: "OFF THE LEASH",
        artist: "LIL LIL, Pete Rango",
        evidenceUrls: ["leash"],
        postedByOwn: true,
        ownerUsername: "p3t3rango",
      },
    ]);
  });

  it("keeps a remix credited to the artist even when a collaborator posted it", () => {
    const refs = deriveMusicReferences(
      [
        post({
          url: "remix",
          isOwnPost: false,
          ownerUsername: "dameatlas",
          musicTitle: "crying on the floor (pete rango mix)",
          musicArtist: "Dame Atlas, Pete Rango",
        }),
      ],
      pete,
    );
    expect(refs[0]).toMatchObject({
      artist: "Dame Atlas, Pete Rango",
      postedByOwn: false,
      ownerUsername: "dameatlas",
    });
  });

  it("merges one credit across posts and ranks by evidence", () => {
    const refs = deriveMusicReferences(
      [
        post({ url: "a1", musicTitle: "A", musicArtist: "Pete Rango" }),
        post({ url: "b1", musicTitle: "B", musicArtist: "Pete Rango" }),
        post({ url: "b2", musicTitle: "b", musicArtist: "pete rango" }),
      ],
      pete,
    );
    expect(refs.map(r => [r.title, r.evidenceUrls])).toEqual([
      ["B", ["b1", "b2"]],
      ["A", ["a1"]],
    ]);
  });
});

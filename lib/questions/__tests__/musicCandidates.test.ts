import { describe, it, expect } from "vitest";
import { musicCandidates } from "@/lib/questions/musicCandidates";

describe("musicCandidates", () => {
  it("never frames another account's post as the artist's own", () => {
    const out = musicCandidates("Pete Rango", [
      {
        title: "crying on the floor",
        artist: "Dame Atlas, Pete Rango",
        evidenceUrls: ["c"],
        postedByOwn: false,
        ownerUsername: "dameatlas",
      },
      {
        title: "Mine",
        artist: "Pete Rango",
        evidenceUrls: ["a", "b"],
        postedByOwn: true,
        ownerUsername: "p3t3rango",
      },
    ]);
    expect(out.map(c => c.signalId)).toEqual([
      "music_mine_pete_rango",
      "music_crying_on_the_floor_dame_atlas_pete_rango",
    ]);
    expect(out[1].authoredBy).toBe("@dameatlas");
    expect(out[1].material).toContain("NOT Pete Rango's own post");
    expect(out[0].material).toBe(
      'Pete Rango tagged the track "Mine" by Pete Rango on their own Instagram post.',
    );
  });
});

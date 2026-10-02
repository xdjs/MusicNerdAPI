import { describe, it, expect } from "vitest";
import { buildCandidates } from "@/lib/questions/buildCandidates";
import { EXTRACTION } from "@/lib/questions/__tests__/extraction";

describe("buildCandidates", () => {
  it("orders relationships, credits, statements, collaborators, themes, standouts, then music", () => {
    const out = buildCandidates(
      {
        collaborators: [{ handle: "dameatlas", postCount: 1, evidenceUrls: ["c"] }],
        themes: [{ term: "housemusic", kind: "hashtag", count: 2, evidenceUrls: ["t"] }],
        standoutPosts: [
          {
            url: "https://www.instagram.com/p/S/",
            metric: "likes",
            value: 9,
            median: 1,
            multiple: 9,
            caption: null,
          },
        ],
        musicReferences: [
          {
            title: "Mine",
            artist: "Pharaoh",
            evidenceUrls: ["m"],
            postedByOwn: true,
            ownerUsername: "p",
          },
        ],
      },
      "Pharaoh",
      EXTRACTION,
    );
    expect(out.map(c => c.key)).toEqual([
      "social_partnership_p3t3rango",
      "social_same_post_B",
      "social_credit_p3t3rango",
      "social_statement_B_a_first",
      "social_statement_Z_what_hourglass_means",
      "social_collaborator_dameatlas",
      "social_theme_hashtag_housemusic",
      "social_standout_S",
      "social_music_mine_pharaoh",
    ]);
    expect(
      out.every(c => c.key === `social_${c.signalId.replace(/^collab_/, "collaborator_")}`),
    ).toBe(true);
  });
});

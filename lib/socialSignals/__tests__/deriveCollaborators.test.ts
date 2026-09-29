import { describe, it, expect } from "vitest";
import { deriveCollaborators } from "@/lib/socialSignals/deriveCollaborators";
import { post } from "@/lib/socialSignals/__tests__/post";

describe("deriveCollaborators", () => {
  it("counts coauthors and foreign owners, never the artist themselves", () => {
    const posts = [
      post({
        ownerUsername: "soft_core.music",
        isOwnPost: false,
        url: "https://www.instagram.com/p/dirtyrow/",
        coauthors: ["p3t3rango", "dear_rod"],
      }),
    ];
    const collaborators = deriveCollaborators(posts, "@P3T3RANGO");
    expect(collaborators.map(c => c.handle)).toEqual(["dear_rod", "soft_core.music"]);
    expect(collaborators[0].evidenceUrls).toEqual(["https://www.instagram.com/p/dirtyrow/"]);
  });

  it("ranks by post count, then handle", () => {
    const posts = [
      post({ url: "u1", coauthors: ["b"] }),
      post({ url: "u2", coauthors: ["a", "b"] }),
      post({ url: "u3", coauthors: ["c"] }),
    ];
    expect(deriveCollaborators(posts, "p3t3rango")).toEqual([
      { handle: "b", postCount: 2, evidenceUrls: ["u1", "u2"] },
      { handle: "a", postCount: 1, evidenceUrls: ["u2"] },
      { handle: "c", postCount: 1, evidenceUrls: ["u3"] },
    ]);
  });

  it("is empty for no posts", () => {
    expect(deriveCollaborators([], "p3t3rango")).toEqual([]);
  });
});

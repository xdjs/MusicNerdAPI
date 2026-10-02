import { describe, it, expect } from "vitest";
import { collaboratorCandidates } from "@/lib/questions/collaboratorCandidates";

describe("collaboratorCandidates", () => {
  it("labels the collaboration by its other account and offers the top three by posts", () => {
    const out = collaboratorCandidates("Pete Rango", [
      { handle: "one", postCount: 1, evidenceUrls: ["u1"] },
      { handle: "dameatlas", postCount: 4, evidenceUrls: ["u2"] },
      { handle: "b", postCount: 2, evidenceUrls: ["u3"] },
      { handle: "c", postCount: 3, evidenceUrls: ["u4"] },
    ]);
    expect(out.map(c => c.key)).toEqual([
      "social_collaborator_dameatlas",
      "social_collaborator_c",
      "social_collaborator_b",
    ]);
    expect(out[0]).toMatchObject({
      signalId: "collab_dameatlas",
      authoredBy: "@dameatlas",
      sourceUrls: ["u2"],
    });
    expect(out[0].material).toContain("across 4 Instagram post(s)");
  });
});

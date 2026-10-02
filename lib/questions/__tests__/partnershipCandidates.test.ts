import { describe, it, expect } from "vitest";
import { partnershipCandidates } from "@/lib/questions/partnershipCandidates";
import { EXTRACTION, credit } from "@/lib/questions/__tests__/extraction";

describe("partnershipCandidates", () => {
  it("offers a collaborator credited on several posts, keyed by unicode slug, with no count", () => {
    const [c] = partnershipCandidates("Pharaoh", EXTRACTION);
    expect(c).toMatchObject({
      signalId: "partnership_p3t3rango",
      key: "social_partnership_p3t3rango",
      kind: "partnership",
      authoredBy: "artist",
      sourceUrls: ["https://www.instagram.com/p/A/", "https://www.instagram.com/p/B/"],
    });
    expect(c.material).toContain("several SEPARATE posts");
    expect(c.material).toContain("must not attach");
    expect(c.material).not.toMatch(/\d+ SEPARATE posts/);
  });

  it("describes the partnership only by roles that recur", () => {
    const [c] = partnershipCandidates("Pete Rango", {
      statements: [],
      credits: [
        credit("zavodskyalan", "A", "production partner"),
        credit("zavodskyalan", "B", "production partner"),
        credit("zavodskyalan", "C", "added some 808s"),
      ],
    });
    expect(c.material).toContain("repeatedly as: production partner.");
    expect(c.material).not.toContain("808s");
  });

  it("skips one-offs and keys a person by the unicode slug of their name", () => {
    // Parity quirk: creditedCollaborators groups by foldName, which strips
    // non-Latin letters, so a name like "사랑" never becomes a collaborator
    // here or in MusicNerdWeb.
    const out = partnershipCandidates("X", {
      statements: [],
      credits: [
        credit("Beyoncé", "A"),
        credit("Beyoncé", "B"),
        credit("사랑", "C"),
        credit("사랑", "D"),
        credit("once", "E"),
      ],
    });
    expect(out.map(c => c.key)).toEqual(["social_partnership_beyoncé"]);
  });
});

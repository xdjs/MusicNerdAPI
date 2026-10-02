import { describe, it, expect } from "vitest";
import { samePostCandidates } from "@/lib/questions/samePostCandidates";
import { EXTRACTION, credit } from "@/lib/questions/__tests__/extraction";

describe("samePostCandidates", () => {
  it("joins the one credit and a statement from the same post, citing only that post", () => {
    const out = samePostCandidates("Pharaoh", EXTRACTION);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      signalId: "same_post_B",
      key: "social_same_post_B",
      kind: "same_post",
      sourceUrls: ["https://www.instagram.com/p/B/"],
    });
    expect(out[0].material).toContain("IN ONE POST");
    expect(out[0].material).toContain('"engineered by"');
  });

  it("skips a roundup post with several credits, and self-credits", () => {
    const url = "https://www.instagram.com/p/R/";
    const out = samePostCandidates("X", {
      credits: [
        credit("a", url),
        credit("b", url),
        { ...credit("me", "https://www.instagram.com/p/S/"), isSelf: true },
      ],
      statements: [
        { quote: "q", topic: "t", url },
        { quote: "q", topic: "t", url: "https://www.instagram.com/p/S/" },
      ],
    });
    expect(out).toEqual([]);
  });
});

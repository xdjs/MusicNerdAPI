import { describe, it, expect } from "vitest";
import { statementCandidates } from "@/lib/questions/statementCandidates";

describe("statementCandidates", () => {
  it("keys a statement by its post and topic, and quotes the artist", () => {
    const [c] = statementCandidates("Pete Rango", [
      {
        quote: "the pandemic was a blessing and a curse",
        topic: "The pandemic",
        url: "https://www.instagram.com/p/S1/",
      },
    ]);
    expect(c).toEqual({
      signalId: "statement_S1_the_pandemic",
      kind: "statement",
      key: "social_statement_S1_the_pandemic",
      authoredBy: "artist",
      material: 'Pete Rango wrote, about The pandemic: "the pandemic was a blessing and a curse"',
      sourceUrls: ["https://www.instagram.com/p/S1/"],
    });
  });

  it("offers the ten best", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      quote: `statement number ${i} which is different`,
      topic: `t${i}`,
      url: `https://www.instagram.com/p/P${i}/`,
    }));
    expect(statementCandidates("X", many)).toHaveLength(10);
  });
});

import { describe, it, expect } from "vitest";
import { creditCandidates } from "@/lib/questions/creditCandidates";
import { EXTRACTION, credit } from "@/lib/questions/__tests__/extraction";

describe("creditCandidates", () => {
  it("hands over the artist's sentences, one line per caption, with no count", () => {
    const [c] = creditCandidates("Pharaoh", EXTRACTION);
    expect(c).toMatchObject({
      signalId: "credit_p3t3rango",
      key: "social_credit_p3t3rango",
      kind: "credit",
      authoredBy: "artist",
    });
    expect(c.material).toMatch(/Each line below is ONE caption/);
    expect(c.material).toMatch(/inside a single line .* belongs together/);
    expect(c.material).toMatch(/DIFFERENT lines do not/);
    expect(c.material).toContain('  "Mixed by @p3t3rango"');
    expect(c.material).not.toMatch(/\d+ post\(s\)/);
  });

  it("offers at most four people and three quotes each", () => {
    const credits = ["a", "b", "c", "d", "e"].flatMap(h =>
      ["1", "2", "3", "4"].map(n =>
        credit(h, `https://www.instagram.com/p/${h}${n}/`, "Mixed by", `q${n} @${h}`),
      ),
    );
    const out = creditCandidates("X", { credits, statements: [] });
    expect(out).toHaveLength(4);
    expect(out[0].material.match(/^ {2}"/gm)).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import { scoreMentions } from "@/lib/evals/scoreMentions";

describe("scoreMentions", () => {
  it("scores 1 when there are no terms", () => {
    expect(scoreMentions("anything", [])).toEqual({ score: 1, missing: [] });
  });

  it("is the share of terms found, and lists the missing ones as given", () => {
    expect(scoreMentions("Dutchmassive and 1998.", ["Dutchmassive", "Dutchy", "1998"])).toEqual({
      score: 2 / 3,
      missing: ["Dutchy"],
    });
  });

  it("ignores case, accents and punctuation", () => {
    expect(scoreMentions("Metiéndo MANO!", ["Metiendo Mano"]).score).toBe(1);
    expect(scoreMentions("Rubén-Blades", ["ruben blades"]).score).toBe(1);
  });

  it("matches whole words only", () => {
    expect(scoreMentions("Dutchyyy is the primary alias.", ["Dutchy"]).missing).toEqual(["Dutchy"]);
    expect(scoreMentions("Dutchy, the producer alias.", ["Dutchy"]).score).toBe(1);
    expect(scoreMentions("in 19980", ["1998"]).score).toBe(0);
  });

  it("matches a title across different capitalisation and punctuation", () => {
    const term = "The Good, the Bad, the Ugly";
    expect(scoreMentions("It was The Good, The Bad, The Ugly.", [term]).score).toBe(1);
    expect(scoreMentions("the good the bad the ugly", [term]).score).toBe(1);
    expect(scoreMentions("the good and the ugly", [term]).score).toBe(0);
  });

  it("treats a leading 'the' in a term as optional", () => {
    expect(scoreMentions("An alias, Chill Factor, appears.", ["The Chill Factor"]).score).toBe(1);
    expect(scoreMentions("The Chill Factor appears.", ["The Chill Factor"]).score).toBe(1);
    expect(scoreMentions("Chill Factor", ["Chill Factor"]).score).toBe(1);
  });
});

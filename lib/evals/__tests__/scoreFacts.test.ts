import { describe, expect, it } from "vitest";
import { scoreFacts } from "@/lib/evals/scoreFacts";

describe("scoreFacts", () => {
  it("scores 1 when there are no facts", () => {
    expect(scoreFacts("anything", [])).toEqual({ score: 1, missing: [] });
  });

  it("is the share of facts found, and lists the missing ones as given", () => {
    expect(scoreFacts("Dutchmassive and 1998.", ["Dutchmassive", "Dutchy", "1998"])).toEqual({
      score: 2 / 3,
      missing: ["Dutchy"],
    });
  });

  it("ignores case, accents and punctuation", () => {
    expect(scoreFacts("Metiéndo MANO!", ["Metiendo Mano"]).score).toBe(1);
    expect(scoreFacts("Rubén-Blades", ["ruben blades"]).score).toBe(1);
  });

  it("matches whole words only", () => {
    expect(scoreFacts("Dutchyyy is the primary alias.", ["Dutchy"]).missing).toEqual(["Dutchy"]);
    expect(scoreFacts("Dutchy, the producer alias.", ["Dutchy"]).score).toBe(1);
    expect(scoreFacts("in 19980", ["1998"]).score).toBe(0);
  });

  it("does not match Dutchy inside Dutchyyy", () => {
    expect(scoreFacts("Dutchyyy", ["Dutchy"])).toEqual({ score: 0, missing: ["Dutchy"] });
  });

  it("matches a title across different capitalisation and punctuation", () => {
    const fact = "The Good, the Bad, the Ugly";
    expect(scoreFacts("It was The Good, The Bad, The Ugly.", [fact]).score).toBe(1);
    expect(scoreFacts("the good the bad the ugly", [fact]).score).toBe(1);
    expect(scoreFacts("the good and the ugly", [fact]).score).toBe(0);
  });

  it("treats a leading 'the' in a fact as optional", () => {
    expect(scoreFacts("An alias, Chill Factor, appears.", ["The Chill Factor"]).score).toBe(1);
    expect(scoreFacts("The Chill Factor appears.", ["The Chill Factor"]).score).toBe(1);
    expect(scoreFacts("Chill Factor", ["Chill Factor"]).score).toBe(1);
  });

  it("counts a fact present when any alternative is", () => {
    expect(scoreFacts("He was seventy-five.", [["75", "seventy-five"]]).score).toBe(1);
    expect(scoreFacts("He was 75.", [["75", "seventy-five"]]).score).toBe(1);
    expect(scoreFacts("Vi$ions", [["Vi$ions", "Visions"]]).score).toBe(1);
    expect(scoreFacts("The album Visions", [["Vi$ions", "Visions"]]).score).toBe(1);
    expect(scoreFacts("Q-Tip", [["Q-Tip", "QTip"]]).score).toBe(1);
    expect(scoreFacts("q tip", [["Q-Tip", "QTip"]]).score).toBe(1);
  });

  it("names the first alternative of a missing fact", () => {
    expect(scoreFacts("nothing", [["75", "seventy-five"], "Dutchy"])).toEqual({
      score: 0,
      missing: ["75", "Dutchy"],
    });
  });

  it("never matches an alternative that normalises to nothing", () => {
    expect(scoreFacts("anything at all", [["", "  "]])).toEqual({ score: 0, missing: [""] });
    expect(scoreFacts("anything at all", [["!!", "anything"]]).score).toBe(1);
    expect(scoreFacts("anything", [[]])).toEqual({ score: 0, missing: [""] });
  });
});

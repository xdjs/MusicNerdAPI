import { describe, expect, it } from "vitest";
import { formatSearchSignals } from "@/lib/evals/formatSearchSignals";

describe("formatSearchSignals", () => {
  it("prints the case key, whether text matched strictly and at all, the best vector score to 3 decimals and weak", () => {
    expect(
      formatSearchSignals("bio-ritmo-origin", {
        weak: false,
        signals: { textMatched: true, anyTextMatched: true, bestVectorScore: 0.61234 },
      }),
    ).toBe(
      "signals bio-ritmo-origin textMatched=true anyTextMatched=true bestVector=0.612 weak=false",
    );
  });

  it("prints none when there was no vector score", () => {
    expect(
      formatSearchSignals("dutchyyy-unanswerable", {
        weak: true,
        signals: { textMatched: false, anyTextMatched: true, bestVectorScore: null },
      }),
    ).toBe(
      "signals dutchyyy-unanswerable textMatched=false anyTextMatched=true bestVector=none weak=true",
    );
  });
});

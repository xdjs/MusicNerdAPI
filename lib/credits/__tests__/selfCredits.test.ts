import { describe, it, expect } from "vitest";
import { selfCredits } from "@/lib/credits/selfCredits";

const self = { subject: "Pharaoh Sistare", isHandle: false, quote: "q", isSelf: true };

describe("selfCredits", () => {
  it("keeps only self-credits, each role once however often the artist signs off with it", () => {
    const out = selfCredits({
      credits: [
        { ...self, role: "Producer", url: "a" },
        { ...self, role: "producer", url: "b" },
        { ...self, role: "Recording Engineer", url: "c" },
        { ...self, isSelf: false, subject: "p3t3rango", role: "Mixed by", url: "d" },
      ],
      statements: [],
    });
    expect(out.map(c => c.role)).toEqual(["Producer", "Recording Engineer"]);
  });
});

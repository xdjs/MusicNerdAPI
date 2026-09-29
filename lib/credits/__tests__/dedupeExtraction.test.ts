import { describe, it, expect } from "vitest";
import { dedupeExtraction } from "@/lib/credits/dedupeExtraction";
import type { CaptionExtraction } from "@/lib/credits/types";

const c = {
  subject: "P3T3RANGO",
  isHandle: true,
  role: "Mixed by",
  quote: "q",
  url: "u",
  isSelf: false,
};

describe("dedupeExtraction", () => {
  it("drops exact repeats in place, comparing folded subjects and lowercased roles and quotes", () => {
    const out: CaptionExtraction = {
      credits: [c, { ...c, subject: "p3t3rango", role: "mixed BY" }, { ...c, url: "other" }],
      statements: [
        { quote: "Hello", topic: "t", url: "u" },
        { quote: "hello", topic: "other", url: "u" },
      ],
    };
    dedupeExtraction(out);
    expect(out.credits).toHaveLength(2);
    expect(out.statements).toHaveLength(1);
  });
});

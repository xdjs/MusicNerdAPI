import { expect, it } from "vitest";
import { researchIntentSupplement } from "@/lib/questionResearch/researchIntentSupplement";

it("adds credit-role vocabulary only for credit requests", () => {
  expect(
    researchIntentSupplement({
      topic: "Artist; musical collaborators; notable collaboration recommendations",
      evidenceNeed: "credits",
      freshness: "stored",
    }),
  ).toContain("produced");
  expect(
    researchIntentSupplement({
      topic: "Artist; collaborators, excluding the Nova project",
      evidenceNeed: "credits",
      freshness: "stored",
    }),
  ).toBeNull();
});

it("does not add comparison vocabulary for reporting requests", () => {
  expect(
    researchIntentSupplement({
      topic: "Artist; evolution of sound since early records",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toBeNull();
});

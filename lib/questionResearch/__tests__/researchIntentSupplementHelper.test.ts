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

it("adds comparison vocabulary only when reporting topic compares a musical dimension", () => {
  expect(
    researchIntentSupplement({
      topic: "How did the sound evolve?",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toContain("synth");
  expect(
    researchIntentSupplement({
      topic: "Artist; evolution of musical sound since early records",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toContain("synth");
  expect(
    researchIntentSupplement({
      topic: "Artist; changes to their touring and personal life",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toBeNull();
  expect(
    researchIntentSupplement({
      topic: "Artist; record label changes since 2020",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toBeNull();
  expect(
    researchIntentSupplement({
      topic: "Artist; early life and influences",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toBeNull();
  expect(
    researchIntentSupplement({
      topic: "Artist; evolution of sound since early records, excluding the album Nova",
      evidenceNeed: "reporting",
      freshness: "stored",
    }),
  ).toBeNull();
});

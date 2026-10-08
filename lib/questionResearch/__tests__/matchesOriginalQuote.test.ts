import { expect, it } from "vitest";
import { matchesOriginalQuote } from "@/lib/questionResearch/matchesOriginalQuote";

const original =
  "I have been quietly building it out  over the past year\n\nto escape platform dependency & create a direct connection.";

it("accepts only whitespace differences in one contiguous original passage", () => {
  expect(
    matchesOriginalQuote(
      original,
      "quietly building it out over the past year to escape platform dependency & create a direct connection",
    ),
  ).toBe(true);
  expect(
    matchesOriginalQuote(
      original,
      "building it out\n over the past year to escape platform dependency",
    ),
  ).toBe(true);
});

it("rejects altered meaning, changed punctuation, case, or stitched passages", () => {
  expect(matchesOriginalQuote(original, "building it out to create a direct connection")).toBe(
    false,
  );
  expect(
    matchesOriginalQuote(
      original,
      "building it out over the past year to avoid platform dependency",
    ),
  ).toBe(false);
  expect(
    matchesOriginalQuote(
      original,
      "building it out over the past year to escape platform dependency and create",
    ),
  ).toBe(false);
  expect(
    matchesOriginalQuote(
      original,
      "Building it out over the past year to escape platform dependency",
    ),
  ).toBe(false);
  expect(matchesOriginalQuote(original, "not building it out over the past year")).toBe(false);
});

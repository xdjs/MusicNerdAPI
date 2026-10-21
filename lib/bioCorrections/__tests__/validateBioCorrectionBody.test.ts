import { it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateBioCorrectionBody } from "@/lib/bioCorrections/validateBioCorrectionBody";

it("accepts a bounded report, trims details and normalizes the source URL", () => {
  expect(
    validateBioCorrectionBody({
      reason: "wrong_artist",
      details: " Namesake ",
      sourceUrl: " example.com/bio ",
      expectedBio: "The bio",
    }),
  ).toEqual({
    reason: "wrong_artist",
    details: "Namesake",
    sourceUrl: "https://example.com/bio",
    expectedBio: "The bio",
  });
  expect(validateBioCorrectionBody({ reason: "other", expectedBio: "The bio" })).toEqual({
    reason: "other",
    details: "",
    sourceUrl: null,
    expectedBio: "The bio",
  });
});

it.each([
  null,
  {},
  { reason: "invented", expectedBio: "bio" },
  { reason: "other", expectedBio: "  " },
  { reason: "other", expectedBio: "x".repeat(12001) },
  { reason: "other", details: "x".repeat(2001), expectedBio: "bio" },
  { reason: "other", details: null, expectedBio: "bio" },
  { reason: "other", sourceUrl: "javascript:alert(1)", expectedBio: "bio" },
  { reason: "other", sourceUrl: "http://localhost/a", expectedBio: "bio" },
  { reason: "other", sourceUrl: "http://10.0.0.1/a", expectedBio: "bio" },
  { reason: "other", sourceUrl: "https://printer.local/a", expectedBio: "bio" },
  { reason: "other", sourceUrl: `https://example.com/${"x".repeat(2048)}`, expectedBio: "bio" },
])("rejects invalid input %#", async value => {
  const result = validateBioCorrectionBody(value);
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    status: "error",
    error: "Choose a reason and enter valid details or a public source URL",
  });
});

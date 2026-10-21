import { it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateLoreSuggestionBody } from "@/lib/loreSuggestions/validateLoreSuggestionBody";

it("canonicalizes a public URL: https for a bare domain, no fragment", () => {
  expect(validateLoreSuggestionBody({ url: " pitchfork.com/features/bike-lane#top " })).toEqual({
    url: "https://pitchfork.com/features/bike-lane",
  });
});

it.each([
  null,
  {},
  { url: 5 },
  { url: "javascript:alert(1)" },
  { url: "http://127.0.0.1/a" },
  { url: "http://[::1]/a" },
  { url: "http://192.168.1.4/a" },
  { url: "http://localhost/a" },
  { url: `https://example.com/${"x".repeat(2048)}` },
])("refuses anything that isn't a public website: %j", async body => {
  const result = validateLoreSuggestionBody(body);
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ status: "error", error: "Enter a public website URL" });
});

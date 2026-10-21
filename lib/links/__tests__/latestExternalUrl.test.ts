import { it, expect } from "vitest";
import { latestExternalUrl } from "@/lib/links/latestExternalUrl";

it.each([
  ["https://example.com/a", "https://example.com/a"],
  ["http://example.com/a", null],
  ["https://user:pw@example.com/", null],
  ["not a url", null],
  [42, null],
])("%j → %j", (value, expected) => {
  expect(latestExternalUrl(value)).toBe(expected);
});

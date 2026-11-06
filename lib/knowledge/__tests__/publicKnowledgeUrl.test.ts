import { it, expect } from "vitest";
import { publicKnowledgeUrl } from "../publicKnowledgeUrl";
it.each([
  "https://example.test/a?token=s",
  "https://example.test/a?api_key=s",
  "https://example.test/a?Signature=s",
  "https://user:password@example.test/a",
  "javascript:alert(1)",
])("never exposes secret-bearing or non-http citation URLs: %s", url =>
  expect(publicKnowledgeUrl(url)).toBeNull(),
);
it("keeps ordinary public URLs", () =>
  expect(publicKnowledgeUrl("https://example.test/a?q=music")).toBe(
    "https://example.test/a?q=music",
  ));

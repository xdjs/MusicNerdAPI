import { it, expect } from "vitest";
import { canonicalizeDestinationUrl } from "@/lib/links/canonicalizeDestinationUrl";

it("serializes a public URL without merging paths, queries or hashes", () => {
  expect(canonicalizeDestinationUrl("Example.com/A?b=1#c")).toBe("https://example.com/A?b=1#c");
  expect(canonicalizeDestinationUrl("javascript:alert(1)")).toBeNull();
});

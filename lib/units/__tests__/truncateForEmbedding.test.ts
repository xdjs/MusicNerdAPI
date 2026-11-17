import { describe, expect, test } from "vitest";
import { truncateForEmbedding } from "@/lib/units/truncateForEmbedding";
import { EMBED_INPUT_CHARS } from "@/lib/units/types";

describe("truncateForEmbedding", () => {
  test("leaves a short text alone", () => {
    expect(truncateForEmbedding("short")).toBe("short");
  });

  test("cuts at the last whitespace in the final 200 characters", () => {
    const text = "a".repeat(EMBED_INPUT_CHARS - 50) + " " + "b".repeat(100);
    expect(truncateForEmbedding(text)).toBe("a".repeat(EMBED_INPUT_CHARS - 50));
  });

  test("hard-cuts when there is no whitespace near the limit", () => {
    const text = "a ".repeat(10) + "b".repeat(EMBED_INPUT_CHARS);
    expect(truncateForEmbedding(text)).toHaveLength(EMBED_INPUT_CHARS);
  });
});

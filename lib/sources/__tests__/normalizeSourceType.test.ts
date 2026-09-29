import { describe, it, expect } from "vitest";
import { normalizeSourceType } from "@/lib/sources/normalizeSourceType";

describe("normalizeSourceType", () => {
  it("keeps a known type, maps aliases, and defaults to article", () => {
    expect(normalizeSourceType("Interview")).toBe("interview");
    expect(normalizeSourceType("news")).toBe("article");
    expect(normalizeSourceType("podcast")).toBe("article");
  });
});

import { describe, it, expect, vi } from "vitest";
import { parseLeniently } from "@/lib/credits/parseLeniently";

describe("parseLeniently", () => {
  it("reads a fenced JSON reply and keeps every item for verification", () => {
    const text =
      '```json\n{"credits":[{"subject":1},{"subject":"a"}],"statements":[{"quote":"q"}]}\n```';
    expect(parseLeniently(text)).toEqual({
      credits: [{ subject: 1 }, { subject: "a" }],
      statements: [{ quote: "q" }],
    });
  });

  it("treats missing arrays as empty", () => {
    expect(parseLeniently('{"credits":"no"}')).toEqual({ credits: [], statements: [] });
  });

  it("logs and returns empty for truncated JSON", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseLeniently('{"credits":[{"subject":"a"')).toEqual({ credits: [], statements: [] });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { clampPage } from "@/lib/db/clampPage";

describe("clampPage", () => {
  it("keeps a page that exists", () => {
    expect(clampPage(2, 60, 25)).toBe(2);
  });

  it("answers the last page past the end", () => {
    expect(clampPage(9, 60, 25)).toBe(3);
  });

  it("answers page 1 when nothing matches", () => {
    expect(clampPage(4, 0, 25)).toBe(1);
  });
});

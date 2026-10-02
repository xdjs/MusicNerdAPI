import { describe, it, expect } from "vitest";
import { isRecutOf } from "@/lib/questions/isRecutOf";

describe("isRecutOf", () => {
  const long = "idiscoveredweb3anditchangedhowithinkaboutart";
  it("is true when one long quote key starts with the other", () => {
    expect(isRecutOf(`${long}entirely`, long)).toBe(true);
    expect(isRecutOf(long, `${long}entirely`)).toBe(true);
  });
  it("keeps short statements that merely open the same way apart", () => {
    expect(isRecutOf("iwent", "iwenthome")).toBe(false);
  });
});

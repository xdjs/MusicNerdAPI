import { describe, it, expect } from "vitest";
import { withoutAt } from "@/lib/artists/withoutAt";

describe("withoutAt", () => {
  it("drops one leading @", () => {
    expect(withoutAt("@PeteRango")).toBe("PeteRango");
    expect(withoutAt("PeteRango")).toBe("PeteRango");
  });
});

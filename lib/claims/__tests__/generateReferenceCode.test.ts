import { describe, it, expect } from "vitest";
import { generateReferenceCode } from "@/lib/claims/generateReferenceCode";

describe("generateReferenceCode", () => {
  it("is MN- and four unambiguous uppercase characters", () => {
    for (let i = 0; i < 200; i++) expect(generateReferenceCode()).toMatch(/^MN-[A-HJ-NP-Z2-9]{4}$/);
  });
});

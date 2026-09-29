import { describe, it, expect } from "vitest";
import { anchorBlock } from "@/lib/relevance/anchorBlock";

describe("anchorBlock", () => {
  it("lists the name, then up to 12 releases and 12 accounts when present", () => {
    expect(anchorBlock({ name: "Black Dave" })).toBe("NAME: Black Dave");
    const many = Array.from({ length: 14 }, (_, i) => `R${i}`);
    const block = anchorBlock({
      name: "Black Dave",
      catalog: many,
      identifiers: ["instagram: blackdave.xyz"],
    });
    expect(block).toBe(
      `NAME: Black Dave\nVERIFIED RELEASES: ${many.slice(0, 12).join(", ")}\nCONFIRMED ACCOUNTS: instagram: blackdave.xyz`,
    );
  });
});

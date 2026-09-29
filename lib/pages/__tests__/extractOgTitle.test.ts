import { describe, it, expect } from "vitest";
import { extractOgTitle } from "@/lib/pages/extractOgTitle";

describe("extractOgTitle", () => {
  it("reads og:title in either order, decoded", () => {
    expect(extractOgTitle('<meta property="og:title" content="Nova &amp; Co">')).toBe("Nova & Co");
    expect(extractOgTitle('<meta content="Nova" property="og:title">')).toBe("Nova");
    expect(extractOgTitle("<title>x</title>")).toBeNull();
  });
});

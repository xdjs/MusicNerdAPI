import { describe, it, expect } from "vitest";
import { extractSnippet } from "@/lib/pages/extractSnippet";

describe("extractSnippet", () => {
  it("prefers the meta description, in either order, then og:description", () => {
    expect(extractSnippet('<meta name="description" content="Desc &amp; more">')).toBe(
      "Desc & more",
    );
    expect(extractSnippet('<meta content="Desc" name="description">')).toBe("Desc");
    expect(
      extractSnippet(
        '<meta property="og:description" content="OG"><meta content="OG2" property="og:description">',
      ),
    ).toBe("OG");
    expect(extractSnippet('<meta content="OG2" property="og:description">')).toBe("OG2");
    expect(extractSnippet("<html></html>")).toBeUndefined();
  });
});

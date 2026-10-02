import { describe, it, expect } from "vitest";
import { slug } from "@/lib/questions/slug";

/** The pattern that generated MusicNerdWeb's stored keys before `slug` was widened. */
const previous = (x: string) =>
  x
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "x";

describe("slug", () => {
  it.each([
    "cool__guy",
    "cool._guy",
    "the_.kid",
    "self-love_journey",
    "_kingkona",
    "crittie_p",
    "sage.breath",
    "why he believes in Subvert",
    "crying on the floor (pete rango mix)",
    "Beyoncé",
    "a_b",
  ])("produces the identical key for ASCII input: %s", input => {
    expect(slug(input)).toBe(previous(input));
  });

  it.each(["日本のアーティスト", "김민준", "Пётр"])("does not fold %s to x", input => {
    expect(previous(input)).toBe("x");
    expect(slug(input)).not.toBe("x");
  });

  it("pins the exact output MusicNerdWeb stores", () => {
    expect(slug("Why he believes in Subvert")).toBe("why_he_believes_in_subvert");
    expect(slug("x".repeat(50))).toHaveLength(40);
    expect(slug("!!!")).toBe("x");
  });
});

import { describe, expect, it } from "vitest";
import { getLinkCount } from "@/lib/artistSearch/getLinkCount";

describe("getLinkCount", () => {
  it("counts the link fields that are set, ignoring null, undefined and empty strings", () => {
    expect(
      getLinkCount({ x: "a", instagram: "b", bandcamp: "", youtube: null, tiktok: undefined }),
    ).toBe(2);
  });

  it("ignores columns that are not link fields", () => {
    expect(getLinkCount({ id: "a", name: "A", spotify: "sp", deezer: "1", customImage: "u" })).toBe(
      0,
    );
  });
});

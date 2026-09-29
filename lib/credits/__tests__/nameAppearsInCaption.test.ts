import { describe, it, expect } from "vitest";
import { nameAppearsInCaption } from "@/lib/credits/nameAppearsInCaption";

describe("nameAppearsInCaption", () => {
  it("finds a name as whole words, in order", () => {
    expect(
      nameAppearsInCaption("Elizabeth Owens", "Strings by Elizabeth Owens, recorded live."),
    ).toBe(true);
  });

  it("does not accept a fragment of another word", () => {
    // "Art" is inside "started"; a coincidence of letters is not a person.
    expect(nameAppearsInCaption("Art", "started this one in a hotel room")).toBe(false);
  });

  it("does not accept the words out of order or an empty name", () => {
    expect(nameAppearsInCaption("Owens Elizabeth", "by Elizabeth Owens")).toBe(false);
    expect(nameAppearsInCaption("@", "by Elizabeth Owens")).toBe(false);
  });
});

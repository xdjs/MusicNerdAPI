import { describe, expect, it } from "vitest";
import { isTheSameTrack } from "@/lib/trackLinks/isTheSameTrack";

describe("isTheSameTrack", () => {
  it("accepts an exact title credited to the artist, however the name is cased or punctuated", () => {
    expect(isTheSameTrack("Rush", "Pete Rango", "rush", "Pete Rango")).toBe(true);
    expect(
      isTheSameTrack("September", "Earth, Wind & Fire", "September", "Earth, Wind & Fire"),
    ).toBe(true);
  });

  it("accepts the artist as one name among several credited", () => {
    expect(isTheSameTrack("Some Song", "Dame Atlas & Pete Rango", "Some Song", "Pete Rango")).toBe(
      true,
    );
    expect(
      isTheSameTrack("Some Song", "Pete Rango feat. Dame Atlas", "Some Song", "Pete Rango"),
    ).toBe(true);
  });

  it("will not accept a longer name that merely starts with the artist", () => {
    expect(isTheSameTrack("Some Song", "Dave East", "Some Song", "Dave")).toBe(false);
  });

  it("refuses a stranger's record with the same title and a near-miss title", () => {
    expect(isTheSameTrack("Thriller", "Michael Jackson", "Thriller", "Pete Rango")).toBe(false);
    expect(isTheSameTrack("rush hour", "Pete Rango", "rush", "Pete Rango")).toBe(false);
  });

  it("accepts the title exception only for a bracketed version credit", () => {
    expect(
      isTheSameTrack(
        "crying on the floor (pete rango mix)",
        "Dame Atlas",
        "crying on the floor (pete rango mix)",
        "Pete Rango",
      ),
    ).toBe(true);
    expect(isTheSameTrack("Rango Sessions", "Somebody Else", "Rango Sessions", "Rango")).toBe(
      false,
    );
    expect(isTheSameTrack("Dave", "Somebody Else", "Dave", "Dave")).toBe(false);
  });

  it("does not treat two different non-Latin titles as the same song", () => {
    expect(isTheSameTrack("恋", "Pete Rango", "사랑", "Pete Rango")).toBe(false);
    expect(isTheSameTrack("사랑", "Pete Rango", "사랑", "Pete Rango")).toBe(true);
  });

  it("never matches when either title or the artist folds to nothing", () => {
    expect(isTheSameTrack("...", "Pete Rango", "...", "Pete Rango")).toBe(false);
    expect(isTheSameTrack("Rush", "Pete Rango", "Rush", "!!!")).toBe(false);
  });
});

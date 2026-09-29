import { describe, it, expect } from "vitest";
import { wordsOf } from "@/lib/credits/wordsOf";

describe("wordsOf", () => {
  it("splits on anything that is not a letter or digit and lowercases", () => {
    expect(wordsOf("Strings by Elizabeth Owens, recorded live.")).toEqual([
      "strings",
      "by",
      "elizabeth",
      "owens",
      "recorded",
      "live",
    ]);
    expect(wordsOf("Sigur Rós!")).toEqual(["sigur", "rós"]);
  });
});

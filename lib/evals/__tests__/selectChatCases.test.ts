import { describe, expect, it } from "vitest";
import { selectChatCases } from "@/lib/evals/selectChatCases";

const cases = [{ key: "a" }, { key: "b" }, { key: "c" }];

describe("selectChatCases", () => {
  it("returns every case for an empty or missing list", () => {
    expect(selectChatCases(cases, undefined)).toEqual(cases);
    expect(selectChatCases(cases, "")).toEqual(cases);
    expect(selectChatCases(cases, " , ")).toEqual(cases);
  });

  it("returns only the listed cases, in suite order, trimming spaces", () => {
    expect(selectChatCases(cases, "c, a")).toEqual([{ key: "a" }, { key: "c" }]);
  });

  it("throws naming every unknown key", () => {
    expect(() => selectChatCases(cases, "a,x,y")).toThrow(/x, y/);
  });

  describe("trials", () => {
    const withTrials = [{ key: "a", trials: 3 }, { key: "b" }];

    it("gives every selected case that many trials, replacing a case's own count", () => {
      expect(selectChatCases(withTrials, "a,b", "4")).toEqual([
        { key: "a", trials: 4 },
        { key: "b", trials: 4 },
      ]);
      expect(selectChatCases(withTrials, "b", " 2 ")).toEqual([{ key: "b", trials: 2 }]);
    });

    it("ignores the count when no case list is set", () => {
      expect(selectChatCases(withTrials, "", "4")).toEqual(withTrials);
      expect(selectChatCases(withTrials, undefined, "4")).toEqual(withTrials);
    });

    it("ignores a count that is not an integer from 2 to 5", () => {
      for (const bad of [undefined, "", "1", "6", "0", "-3", "2.5", "abc", "3x"])
        expect(selectChatCases(withTrials, "a,b", bad)).toEqual(withTrials);
    });
  });
});

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

    it("applies to every case when no case list is set", () => {
      const all = [
        { key: "a", trials: 4 },
        { key: "b", trials: 4 },
      ];
      expect(selectChatCases(withTrials, "", "4")).toEqual(all);
      expect(selectChatCases(withTrials, undefined, "4")).toEqual(all);
      expect(selectChatCases(cases, undefined, "5")).toEqual(cases.map(c => ({ ...c, trials: 5 })));
    });

    it("accepts 1, which removes repeats", () => {
      expect(selectChatCases(withTrials, "a", "1")).toEqual([{ key: "a", trials: 1 }]);
    });

    it("ignores a count that is not an integer from 1 to 5", () => {
      for (const bad of [undefined, "", "6", "0", "-3", "2.5", "abc", "3x"]) {
        expect(selectChatCases(withTrials, "a,b", bad)).toEqual(withTrials);
        expect(selectChatCases(withTrials, undefined, bad)).toEqual(withTrials);
      }
    });
  });
});

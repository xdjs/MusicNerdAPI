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
});

import { describe, expect, it, vi } from "vitest";
import { getSearchTuning } from "@/lib/units/getSearchTuning";
import { MAX_UNITS_PER_DOCUMENT, SEARCH_CANDIDATES } from "@/lib/units/types";

const defaults = {
  maxUnitsPerDocument: MAX_UNITS_PER_DOCUMENT,
  textMode: "and",
  candidates: SEARCH_CANDIDATES,
};

describe("getSearchTuning", () => {
  it("defaults to today's ranking when nothing is set", () => {
    expect(getSearchTuning({})).toEqual(defaults);
    expect(
      getSearchTuning({ UNITS_MAX_PER_DOCUMENT: "", UNITS_TEXT_MODE: "", UNITS_CANDIDATES: "" }),
    ).toEqual(defaults);
  });

  it("reads each override", () => {
    expect(
      getSearchTuning({
        UNITS_MAX_PER_DOCUMENT: "5",
        UNITS_TEXT_MODE: "or",
        UNITS_CANDIDATES: "40",
      }),
    ).toEqual({ maxUnitsPerDocument: 5, textMode: "or", candidates: 40 });
    expect(getSearchTuning({ UNITS_MAX_PER_DOCUMENT: "1" }).maxUnitsPerDocument).toBe(1);
    expect(getSearchTuning({ UNITS_MAX_PER_DOCUMENT: " 8 " }).maxUnitsPerDocument).toBe(8);
    expect(getSearchTuning({ UNITS_TEXT_MODE: "and" }).textMode).toBe("and");
    expect(getSearchTuning({ UNITS_CANDIDATES: "10" }).candidates).toBe(10);
    expect(getSearchTuning({ UNITS_CANDIDATES: "60" }).candidates).toBe(60);
  });

  it("falls back to the default for an invalid value", () => {
    for (const value of ["0", "9", "3.5", "-2", "abc", "1e1"])
      expect(getSearchTuning({ UNITS_MAX_PER_DOCUMENT: value }).maxUnitsPerDocument, value).toBe(
        MAX_UNITS_PER_DOCUMENT,
      );
    for (const value of ["9", "61", "20.5", "lots"])
      expect(getSearchTuning({ UNITS_CANDIDATES: value }).candidates, value).toBe(
        SEARCH_CANDIDATES,
      );
    for (const value of ["xor", "any", "OR AND"])
      expect(getSearchTuning({ UNITS_TEXT_MODE: value }).textMode, value).toBe("and");
  });

  it("reads process.env by default", () => {
    vi.stubEnv("UNITS_TEXT_MODE", "or");
    expect(getSearchTuning().textMode).toBe("or");
    vi.unstubAllEnvs();
  });
});

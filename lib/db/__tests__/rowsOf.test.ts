import { describe, it, expect } from "vitest";
import { rowsOf } from "@/lib/db/rowsOf";

describe("rowsOf", () => {
  it("reads rows from an array result or a { rows } result", () => {
    expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rowsOf({ rows: [{ a: 2 }] })).toEqual([{ a: 2 }]);
  });

  it("is empty for a result carrying no rows, which is an answer, not an error", () => {
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf(undefined)).toEqual([]);
    expect(rowsOf({})).toEqual([]);
  });
});

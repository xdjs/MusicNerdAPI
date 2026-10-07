import { expect, it } from "vitest";
import { validateBoundaryListQuery } from "@/lib/interviewMemory/validateBoundaryListQuery";
it("accepts only a current sitting and optional bounded continuation", () => {
  expect(validateBoundaryListQuery({ sitting: "2", cursor: "cursor" })).toEqual({
    sitting: 2,
    cursor: "cursor",
  });
  for (const query of [
    {},
    { sitting: "0" },
    { sitting: "2147483648" },
    { sitting: "2", cursor: "" },
    { sitting: "2", cursor: "x".repeat(4097) },
    { sitting: "2", maxChars: "100000" },
  ])
    expect(() => validateBoundaryListQuery(query)).toThrow(/query/);
});

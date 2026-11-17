import { describe, expect, test } from "vitest";
import { readErrorStatus } from "@/lib/units/readErrorStatus";

describe("readErrorStatus", () => {
  test("returns a status from 100 to 599", () => {
    expect(readErrorStatus({ statusCode: 429 })).toBe(429);
    expect(readErrorStatus({ statusCode: 100 })).toBe(100);
    expect(readErrorStatus({ statusCode: 599 })).toBe(599);
  });

  test("returns undefined for anything else", () => {
    for (const v of [
      { statusCode: 99 },
      { statusCode: 600 },
      { statusCode: 4.5 },
      { statusCode: "400" },
      {},
      null,
      undefined,
      "x",
    ])
      expect(readErrorStatus(v)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateSelfEditsQuery } from "@/lib/contributions/validateSelfEditsQuery";

describe("validateSelfEditsQuery", () => {
  it("defaults to page 1 and accepts a whole number from 1", () => {
    expect(validateSelfEditsQuery(new Request("https://example.org/api/selfEdits"))).toEqual({
      page: 1,
    });
    expect(validateSelfEditsQuery(new Request("https://example.org/api/selfEdits?page=3"))).toEqual(
      { page: 3 },
    );
  });

  it.each(["?page=0", "?page=-1", "?page=1.5", "?page=abc", "?page="])(
    "rejects %s with a 400",
    async suffix => {
      const result = validateSelfEditsQuery(
        new Request(`https://example.org/api/selfEdits${suffix}`),
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
      expect(await (result as NextResponse).json()).toEqual({
        status: "error",
        error: "Invalid page",
      });
    },
  );
});

import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateActivityQuery } from "@/lib/activityFeed/validateActivityQuery";

describe("validateActivityQuery", () => {
  it("accepts no `since` and any parseable date", () => {
    expect(validateActivityQuery(new Request("https://example.org/api/activity"))).toEqual({
      since: undefined,
    });
    expect(
      validateActivityQuery(
        new Request("https://example.org/api/activity?since=2026-10-20T00:00:00.000Z"),
      ),
    ).toEqual({ since: "2026-10-20T00:00:00.000Z" });
  });

  it.each(["?since=", "?since=yesterday"])("rejects %s with a 400", async suffix => {
    const result = validateActivityQuery(new Request(`https://example.org/api/activity${suffix}`));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(await (result as NextResponse).json()).toEqual({
      status: "error",
      error: "Invalid since parameter",
    });
  });
});

import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUserSearchQuery } from "@/lib/adminUsers/validateUserSearchQuery";

const request = (query: string) =>
  new Request(`https://api.musicnerd.test/api/admin/users${query}`);

describe("validateUserSearchQuery", () => {
  it("returns the trimmed search", () => {
    expect(validateUserSearchQuery(request("?search=%20dutch%20"))).toEqual({ search: "dutch" });
  });

  it.each(["", "?search=", "?search=%20%20"])("treats %j as no search", query => {
    expect(validateUserSearchQuery(request(query))).toEqual({ search: undefined });
  });

  it.each(["?search=ab", "?search=%20ab%20"])("rejects %j", async query => {
    const res = validateUserSearchQuery(request(query));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Search must be at least 3 characters",
    });
  });
});

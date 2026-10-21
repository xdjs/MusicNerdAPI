import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateProfileArtistsQuery } from "@/lib/profile/validateProfileArtistsQuery";

const request = (query: string) => new Request(`https://x/api/profile/artists${query}`);

describe("validateProfileArtistsQuery", () => {
  it("defaults to offset 0 and no search", () => {
    expect(validateProfileArtistsQuery(request(""))).toEqual({ offset: 0, query: "" });
  });

  it("parses the offset and trims the search", () => {
    expect(validateProfileArtistsQuery(request("?offset=24&q=%20ritmo%20"))).toEqual({
      offset: 24,
      query: "ritmo",
    });
  });

  it.each([
    ["a negative offset", "?offset=-1"],
    ["a non-numeric offset", "?offset=abc"],
    ["a seven-digit offset", "?offset=1234567"],
    ["a search over 200 characters", `?q=${"a".repeat(201)}`],
  ])("is 400 for %s", async (_label, query) => {
    const res = validateProfileArtistsQuery(request(query));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Invalid artist search",
    });
  });
});

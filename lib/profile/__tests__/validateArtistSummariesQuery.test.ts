import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistSummariesQuery } from "@/lib/profile/validateArtistSummariesQuery";

const a = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const b = "11111111-1111-4111-8111-111111111111";
const request = (query: string) => new Request(`https://x/api/profile/artist-summaries${query}`);

describe("validateArtistSummariesQuery", () => {
  it("returns the distinct ids", () => {
    expect(validateArtistSummariesQuery(request(`?id=${a}&id=${b}&id=${a}`))).toEqual([a, b]);
    expect(validateArtistSummariesQuery(request(`?id=${a.toUpperCase()}`))).toEqual([
      a.toUpperCase(),
    ]);
  });

  it.each([
    ["no id", ""],
    [
      "seven ids",
      "?" + Array.from({ length: 7 }, (_, i) => `id=${b.replace(/1/g, String(i + 2))}`).join("&"),
    ],
    ["a non-UUID", `?id=${a}&id=bio-ritmo`],
  ])("is 400 for %s", (_label, query) => {
    const res = validateArtistSummariesQuery(request(query));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
  });

  it("says what is expected", async () => {
    expect(await (validateArtistSummariesQuery(request("")) as NextResponse).json()).toEqual({
      status: "error",
      error: "Provide up to six artist IDs",
    });
  });
});

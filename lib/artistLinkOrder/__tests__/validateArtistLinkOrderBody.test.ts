import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistLinkOrderBody } from "@/lib/artistLinkOrder/validateArtistLinkOrderBody";

const artistId = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";

describe("validateArtistLinkOrderBody", () => {
  it("returns a valid body", () => {
    expect(
      validateArtistLinkOrderBody({ artistId, section: "support", order: ["bandcamp"] }),
    ).toEqual({ artistId, section: "support", order: ["bandcamp"] });
  });

  it.each([
    null,
    { artistId: "nope", section: "links", order: [] },
    { artistId, section: "other", order: [] },
    { artistId, section: "links", order: ["a", "a"] },
    { artistId, section: "links", order: [""] },
    { artistId, section: "links", order: ["x".repeat(81)] },
    { artistId, section: "links", order: Array.from({ length: 101 }, (_, i) => `p${i}`) },
  ])("400s with `Invalid link order` for %j", async body => {
    const res = validateArtistLinkOrderBody(body);
    expect(res).toBeInstanceOf(NextResponse);
    const response = res as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "error", error: "Invalid link order" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

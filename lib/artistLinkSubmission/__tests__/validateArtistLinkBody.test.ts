import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistLinkBody } from "@/lib/artistLinkSubmission/validateArtistLinkBody";

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const errorOf = async (r: unknown) => {
  expect(r).toBeInstanceOf(NextResponse);
  const res = r as NextResponse;
  expect(res.status).toBe(400);
  return (await res.json()).error;
};

describe("validateArtistLinkBody", () => {
  it("returns the artist id and the trimmed url", () => {
    expect(validateArtistLinkBody({ url: " https://x.com/a " }, id)).toEqual({
      artistId: id,
      url: "https://x.com/a",
    });
  });

  it("400s a bad id or a missing url", async () => {
    expect(await errorOf(validateArtistLinkBody({ url: "https://x.com/a" }, "nope"))).toBe(
      "id must be a UUID",
    );
    expect(await errorOf(validateArtistLinkBody({}, id))).toBe("url is required");
    expect(await errorOf(validateArtistLinkBody({ url: "  " }, id))).toBe("url is required");
    expect(await errorOf(validateArtistLinkBody(null, id))).toBe("url is required");
  });
});

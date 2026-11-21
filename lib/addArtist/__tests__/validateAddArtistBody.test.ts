import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAddArtistBody } from "@/lib/addArtist/validateAddArtistBody";

const errorOf = async (r: unknown) => {
  expect(r).toBeInstanceOf(NextResponse);
  expect((r as NextResponse).status).toBe(400);
  return (await (r as NextResponse).json()).error;
};

describe("validateAddArtistBody", () => {
  it("defaults to Spotify and no force", () => {
    expect(validateAddArtistBody({ platformId: " abc " })).toEqual({
      platformId: "abc",
      platform: "spotify",
      forceCreate: false,
    });
    expect(
      validateAddArtistBody({ platformId: "1", platform: "deezer", forceCreate: true }),
    ).toEqual({
      platformId: "1",
      platform: "deezer",
      forceCreate: true,
    });
  });

  it("400s a missing id, another platform or a non-boolean force", async () => {
    expect(await errorOf(validateAddArtistBody(null))).toBe("platformId is required");
    expect(await errorOf(validateAddArtistBody({ platformId: "" }))).toBe("platformId is required");
    expect(await errorOf(validateAddArtistBody({ platformId: "a", platform: "tidal" }))).toBe(
      "platform must be 'spotify' or 'deezer'",
    );
    expect(await errorOf(validateAddArtistBody({ platformId: "a", forceCreate: "yes" }))).toBe(
      "forceCreate must be a boolean",
    );
  });
});

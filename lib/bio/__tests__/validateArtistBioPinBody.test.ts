import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateArtistBioPinBody } from "@/lib/bio/validateArtistBioPinBody";

const vid = "5b7f3c1e-2d4a-4e8b-9c6f-1a2b3c4d5e6f";

describe("validateArtistBioPinBody", () => {
  it("returns the version id", () => {
    expect(validateArtistBioPinBody({ versionId: vid })).toEqual({ versionId: vid });
  });

  it("refuses a missing or non-UUID version id", async () => {
    for (const body of [null, {}, { versionId: "nope" }]) {
      const res = validateArtistBioPinBody(body);
      expect(res).toBeInstanceOf(NextResponse);
      expect((res as NextResponse).status).toBe(400);
      expect(await (res as NextResponse).json()).toEqual({
        status: "error",
        error: "versionId must be a UUID",
      });
    }
  });
});

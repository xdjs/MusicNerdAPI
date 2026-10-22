import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validatePhotoChoiceQuery } from "@/lib/artistImages/validatePhotoChoiceQuery";

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";

describe("validatePhotoChoiceQuery", () => {
  it("returns the artist id when it is a UUID", () => {
    const request = new Request(`https://api.test/api/artist/photo-choice?artistId=${ARTIST}`);
    expect(validatePhotoChoiceQuery(request)).toBe(ARTIST);
  });

  it("answers 400 'Invalid artist' with CORS and no-store when it is missing or not a UUID", async () => {
    for (const query of ["", "?artistId=abc"]) {
      const result = validatePhotoChoiceQuery(
        new Request(`https://api.test/api/artist/photo-choice${query}`),
      );
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: "error", error: "Invalid artist" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

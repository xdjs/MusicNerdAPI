import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validatePhotoChoiceBody } from "@/lib/artistImages/validatePhotoChoiceBody";

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const valid = {
  artistId: ARTIST,
  source: "deezer",
  imageUrl: "https://cdn.deezer/xl.jpg",
  expectedCustomImage: null,
  providerId: "5590",
};
const post = (body: unknown) =>
  new Request("https://api.test/api/artist/photo-choice", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("validatePhotoChoiceBody", () => {
  it("returns the parsed choice", async () => {
    expect(await validatePhotoChoiceBody(post(valid))).toEqual(valid);
    expect(
      await validatePhotoChoiceBody(post({ ...valid, expectedCustomImage: "https://old/x.jpg" })),
    ).toMatchObject({ expectedCustomImage: "https://old/x.jpg" });
  });

  it("answers 400 'Invalid photo choice' for a bad body", async () => {
    const bad = [
      "not json",
      { ...valid, extra: 1 },
      { ...valid, artistId: "abc" },
      { ...valid, source: "apple" },
      { ...valid, imageUrl: "not a url" },
      { ...valid, providerId: "" },
      { ...valid, expectedCustomImage: undefined },
    ];
    for (const body of bad) {
      const result = await validatePhotoChoiceBody(post(body));
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: "error", error: "Invalid photo choice" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateHeaderPositionBody } from "@/lib/artistImages/validateHeaderPositionBody";

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const valid = { artistId: ARTIST, imageUrl: "https://cdn.deezer/xl.jpg", y: 35 };
const patch = (body: unknown) =>
  new Request("https://api.test/api/artist/header-position", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("validateHeaderPositionBody", () => {
  it("accepts an https URL without credentials, or a site-relative path", async () => {
    expect(await validateHeaderPositionBody(patch(valid))).toEqual(valid);
    expect(
      await validateHeaderPositionBody(patch({ ...valid, imageUrl: "/default_pfp_pink.png" })),
    ).toMatchObject({ imageUrl: "/default_pfp_pink.png" });
    expect(await validateHeaderPositionBody(patch({ ...valid, y: 0 }))).toMatchObject({ y: 0 });
    expect(await validateHeaderPositionBody(patch({ ...valid, y: 100 }))).toMatchObject({
      y: 100,
    });
  });

  it("answers 400 'Invalid photo position' for a bad body", async () => {
    const bad = [
      "not json",
      { ...valid, extra: 1 },
      { ...valid, artistId: "abc" },
      { ...valid, imageUrl: "http://cdn.deezer/xl.jpg" },
      { ...valid, imageUrl: "https://user:pw@cdn.deezer/xl.jpg" },
      { ...valid, imageUrl: "//evil.example/x.png" },
      { ...valid, imageUrl: "/a\\b.png" },
      { ...valid, imageUrl: "relative.png" },
      { ...valid, y: -1 },
      { ...valid, y: 101 },
      { ...valid, y: 1.5 },
      { ...valid, y: "35" },
    ];
    for (const body of bad) {
      const result = await validateHeaderPositionBody(patch(body));
      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: "error", error: "Invalid photo position" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });
});

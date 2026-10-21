import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateRemoveArtistDataBody } from "@/lib/removeArtistData/validateRemoveArtistDataBody";

const request = (body: string) =>
  new Request("https://api.test/api/removeArtistData", { method: "POST", body });

describe("validateRemoveArtistDataBody", () => {
  it("returns artistId and siteName", async () => {
    expect(
      await validateRemoveArtistDataBody(
        request(JSON.stringify({ artistId: "a1", siteName: "x" })),
      ),
    ).toEqual({ artistId: "a1", siteName: "x" });
  });

  it.each([
    ["nope", "Invalid request body"],
    ["null", "artistId and siteName are required"],
    [JSON.stringify({ artistId: "a1" }), "artistId and siteName are required"],
    [JSON.stringify({ artistId: "a1", siteName: 3 }), "artistId and siteName are required"],
  ])("400s %s with %s", async (body, message) => {
    const res = (await validateRemoveArtistDataBody(request(body))) as NextResponse;
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: message });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

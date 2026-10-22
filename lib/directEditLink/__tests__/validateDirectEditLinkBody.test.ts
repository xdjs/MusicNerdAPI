import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateDirectEditLinkBody } from "@/lib/directEditLink/validateDirectEditLinkBody";

const artistId = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
async function errorOf(body: unknown) {
  const res = validateDirectEditLinkBody(body) as NextResponse;
  expect(res).toBeInstanceOf(NextResponse);
  expect(res.status).toBe(400);
  expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  return ((await res.json()) as { error: string }).error;
}

describe("validateDirectEditLinkBody", () => {
  it("returns set and clear bodies", () => {
    expect(validateDirectEditLinkBody({ artistId, action: "set", url: "https://x.test" })).toEqual({
      artistId,
      action: "set",
      url: "https://x.test",
      siteName: undefined,
    });
    expect(validateDirectEditLinkBody({ artistId, action: "clear", siteName: "x" })).toEqual({
      artistId,
      action: "clear",
      url: undefined,
      siteName: "x",
    });
  });

  it("keeps MusicNerdWeb's messages, in its order", async () => {
    expect(await errorOf(null)).toBe("artistId and action are required");
    expect(await errorOf({ artistId })).toBe("artistId and action are required");
    expect(await errorOf({ artistId: "nope", action: "move" })).toBe(
      "action must be 'set' or 'clear'",
    );
    expect(await errorOf({ artistId: "nope", action: "set" })).toBe("artistId must be a UUID");
  });

  it("treats a url or siteName that isn't a string as missing", () => {
    expect(validateDirectEditLinkBody({ artistId, action: "set", url: 5, siteName: {} })).toEqual({
      artistId,
      action: "set",
      url: undefined,
      siteName: undefined,
    });
  });
});

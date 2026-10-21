import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateEditBookmarksBody } from "@/lib/account/validateEditBookmarksBody";

const ARTIST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/bookmarks", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

describe("validateEditBookmarksBody", () => {
  it("returns both lists, lower-cased", async () => {
    expect(
      await validateEditBookmarksBody(
        request({ orderedArtistIds: [ARTIST.toUpperCase()], removedArtistIds: [] }),
      ),
    ).toEqual({ orderedArtistIds: [ARTIST], removedArtistIds: [] });
  });

  it.each([
    { orderedArtistIds: [ARTIST] },
    { orderedArtistIds: [ARTIST], removedArtistIds: ["nope"] },
    { orderedArtistIds: [ARTIST], removedArtistIds: [], extra: 1 },
  ])("rejects %j", async body => {
    const res = await validateEditBookmarksBody(request(body));
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) expect(res.status).toBe(400);
  });
});

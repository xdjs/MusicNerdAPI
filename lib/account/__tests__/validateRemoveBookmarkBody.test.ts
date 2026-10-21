import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateRemoveBookmarkBody } from "@/lib/account/validateRemoveBookmarkBody";

const ARTIST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/bookmarks", {
    method: "DELETE",
    body: JSON.stringify(body),
  });

describe("validateRemoveBookmarkBody", () => {
  it("returns the id, lower-cased", async () => {
    expect(await validateRemoveBookmarkBody(request({ artistId: ARTIST.toUpperCase() }))).toEqual({
      artistId: ARTIST,
    });
  });

  it.each([{ artistId: "nope" }, { artistId: ARTIST, extra: 1 }, {}])("rejects %j", async body => {
    const res = await validateRemoveBookmarkBody(request(body));
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) expect(res.status).toBe(400);
  });
});

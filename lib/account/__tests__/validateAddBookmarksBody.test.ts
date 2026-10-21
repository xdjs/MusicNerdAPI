import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAddBookmarksBody } from "@/lib/account/validateAddBookmarksBody";

const ARTIST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = (body: unknown) =>
  new Request("https://api.musicnerd.test/api/bookmarks", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("validateAddBookmarksBody", () => {
  it("lower-cases the ids and defaults import to false", async () => {
    expect(await validateAddBookmarksBody(request({ artistIds: [ARTIST.toUpperCase()] }))).toEqual({
      artistIds: [ARTIST],
      import: false,
    });
    expect(await validateAddBookmarksBody(request({ artistIds: [], import: true }))).toEqual({
      artistIds: [],
      import: true,
    });
  });

  it.each([
    null,
    [],
    { artistIds: ["bad"] },
    { artistIds: Array(501).fill(ARTIST) },
    { artistIds: [ARTIST], userId: "22222222-2222-4222-8222-222222222222" },
    { artistIds: [ARTIST], imageUrl: "https://evil.test/photo" },
    "{",
  ])("rejects %j", async body => {
    const res = await validateAddBookmarksBody(request(body));
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) expect(res.status).toBe(400);
  });
});

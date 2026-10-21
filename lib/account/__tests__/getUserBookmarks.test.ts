import { describe, it, expect } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";
import { getUserBookmarks } from "@/lib/account/getUserBookmarks";

const USER = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("getUserBookmarks", () => {
  it("joins current artist names and only safe stored images for the requested owner", async () => {
    const { tx, log } = mockTransaction([
      [
        { artistId: A, artistName: "Current name", imageUrl: "/uploaded.png", deezer: null },
        { artistId: B, artistName: null, imageUrl: "javascript:alert(1)", deezer: null },
        { artistId: C, artistName: "Third", imageUrl: "//other.test/picture", deezer: null },
      ],
    ]);
    expect(await getUserBookmarks(USER, tx as never)).toEqual([
      { artistId: A, artistName: "Current name", imageUrl: "/uploaded.png" },
      { artistId: B, artistName: "Unknown Artist", imageUrl: null },
      { artistId: C, artistName: "Third", imageUrl: null },
    ]);
    expect(log[0].params).toEqual([USER]);
    expect(log[0].text).toContain('"removed_at" is null');
  });

  it("uses only a known numeric Deezer ID for a stable image fallback", async () => {
    const { tx } = mockTransaction([
      [
        { artistId: A, artistName: "A", imageUrl: null, deezer: "27" },
        { artistId: B, artistName: "B", imageUrl: "", deezer: "../search" },
      ],
    ]);
    expect((await getUserBookmarks(USER, tx as never)).map(({ imageUrl }) => imageUrl)).toEqual([
      "https://api.deezer.com/artist/27/image?size=medium",
      null,
    ]);
  });
});

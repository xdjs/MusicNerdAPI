import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistSocialPosts: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));
const { getSocialPostsOrNull } = await import("@/lib/instagram/getSocialPostsOrNull");

const row = {
  platform: "instagram",
  platformPostId: "1",
  ownerUsername: "bioritmo",
  isOwnPost: true,
  caption: "c",
  url: "https://www.instagram.com/p/1/",
  postedAt: null,
  likeCount: 1,
  commentCount: 0,
  playCount: null,
  hashtags: null,
  mentions: ["a"],
  coauthors: null,
  musicTitle: null,
  musicArtist: null,
  raw: { big: true },
};

beforeEach(() => findMany.mockReset());

describe("getSocialPostsOrNull", () => {
  it("maps rows to SocialPostRow, defaulting a missing date and arrays", async () => {
    findMany.mockResolvedValueOnce([row]);
    expect(await getSocialPostsOrNull("a")).toEqual([
      {
        platform: "instagram",
        platformPostId: "1",
        ownerUsername: "bioritmo",
        isOwnPost: true,
        caption: "c",
        url: "https://www.instagram.com/p/1/",
        postedAt: "",
        likeCount: 1,
        commentCount: 0,
        playCount: null,
        hashtags: [],
        mentions: ["a"],
        coauthors: [],
        musicTitle: null,
        musicArtist: null,
      },
    ]);
  });

  it("is null, not empty, when the read fails", async () => {
    findMany.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getSocialPostsOrNull("a")).toBeNull();
  });
});

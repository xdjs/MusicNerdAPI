import { describe, it, expect } from "vitest";
import { socialProfileHandle } from "@/lib/social/socialProfileHandle";
import { mapSocialPost } from "@/lib/social/mapSocialPost";
import { selectReelsForTranscript } from "@/lib/social/selectReelsForTranscript";

describe("social research inputs and attribution", () => {
  it("accepts handles and canonical profile URLs, rejecting search and foreign hosts", () => {
    expect(socialProfileHandle("https://www.tiktok.com/@artist", "tiktok")).toBe("artist");
    expect(socialProfileHandle("https://twitter.com/Artist", "x")).toBe("artist");
    expect(socialProfileHandle("@Artist", "x")).toBe("artist");
    expect(socialProfileHandle("https://example.com/artist", "x")).toBeNull();
    expect(socialProfileHandle("https://x.com/search?q=artist", "x")).toBeNull();
    expect(socialProfileHandle("https://x.com/artist/status/1", "x")).toBeNull();
  });

  it("maps TikTok's actual profile video fields without claiming somebody else's post", () => {
    const raw = {
      id: "123",
      webVideoUrl: "https://www.tiktok.com/@artist/video/123",
      authorMeta: { name: "artist" },
      text: "Made this with @producer",
      createTime: 1720000000,
      diggCount: 5,
      commentCount: 2,
      playCount: 100,
      hashtags: [{ name: "music" }],
    };
    expect(mapSocialPost(raw, "a", "tiktok", "artist")).toMatchObject({
      platform: "tiktok",
      platformPostId: "123",
      isOwnPost: true,
      caption: raw.text,
      likeCount: 5,
      hashtags: ["music"],
      mentions: ["producer"],
    });
    expect(mapSocialPost(raw, "a", "tiktok", "other")).toBeNull();
    expect(
      mapSocialPost(
        { ...raw, webVideoUrl: "https://evil.test/video/123" },
        "a",
        "tiktok",
        "artist",
      ),
    ).toBeNull();
  });

  it("maps X and excludes reposts, quoted text and malformed records", () => {
    const raw = {
      id: "123",
      url: "https://x.com/artist/status/123",
      author: { userName: "Artist" },
      text: "My own comment",
      createdAt: "Fri Nov 24 17:49:36 +0000 2023",
      likeCount: 3,
      replyCount: 1,
      quotedTweet: { text: "Not the artist's words" },
    };
    expect(mapSocialPost(raw, "a", "x", "artist")).toMatchObject({
      caption: raw.text,
      postedAt: "2023-11-24T17:49:36.000Z",
      platform: "x",
    });
    expect(mapSocialPost({ ...raw, isRetweet: true }, "a", "x", "artist")).toBeNull();
    expect(mapSocialPost({ ...raw, createdAt: "invalid" }, "a", "x", "artist")).toBeNull();
    expect(mapSocialPost({ error: "not found" }, "a", "x", "artist")).toBeNull();
  });

  it("selects only own short reels lacking caption context and prior transcription", () => {
    const reel = {
      platformPostId: "1",
      ownerUsername: "artist",
      isOwnPost: true,
      caption: "#newmusic",
      url: "https://www.instagram.com/p/Abc/",
      raw: { type: "Video", productType: "clips", videoDuration: 60 },
    };
    const rows = [
      reel,
      { ...reel, platformPostId: "2", caption: "A".repeat(200) },
      { ...reel, platformPostId: "3", isOwnPost: false },
      {
        ...reel,
        platformPostId: "4",
        raw: { ...reel.raw, _musicnerdTranscript: { text: "already read" } },
      },
      { ...reel, platformPostId: "5", raw: { ...reel.raw, videoDuration: 600 } },
      { ...reel, platformPostId: "6", raw: { ...reel.raw, videoDuration: undefined } },
    ];
    expect(selectReelsForTranscript(rows)).toEqual([{ id: "1", url: reel.url, owner: "artist" }]);
    expect(
      selectReelsForTranscript(
        Array.from({ length: 10 }, (_, i) => ({ ...reel, platformPostId: String(i) })),
      ),
    ).toHaveLength(3);
  });
});

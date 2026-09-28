import { describe, it, expect, vi } from "vitest";
import { upsertSocialPost } from "@/lib/instagram/upsertSocialPost";
import { artistSocialPosts } from "@/lib/db/schema";

describe("upsertSocialPost", () => {
  it("upserts on (artist, platform, post id) and refreshes the metadata", async () => {
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const row = {
      artistId: "a",
      platform: "instagram",
      platformPostId: "1",
      ownerUsername: "artist",
      isOwnPost: true,
      caption: "hi",
      url: "https://x/1",
      postedAt: null,
      likeCount: 1,
      commentCount: 0,
      playCount: null,
      hashtags: [],
      mentions: [],
      coauthors: [],
      musicTitle: null,
      musicArtist: null,
      raw: {},
    };
    await upsertSocialPost(row, { insert } as any);
    expect(insert).toHaveBeenCalledWith(artistSocialPosts);
    expect(values).toHaveBeenCalledWith(row);
    const conflict = (onConflictDoUpdate.mock.calls[0] as any[])[0];
    expect(conflict.target).toEqual([
      artistSocialPosts.artistId,
      artistSocialPosts.platform,
      artistSocialPosts.platformPostId,
    ]);
    expect(conflict.set).toMatchObject({ caption: "hi", likeCount: 1, isOwnPost: true });
    expect(conflict.set.raw).toBeDefined();
  });
});

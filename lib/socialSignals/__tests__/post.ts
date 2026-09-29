import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * A stored post for tests, with every field defaulted.
 *
 * @param over - The fields that matter to the test.
 * @returns A full SocialPostRow.
 */
export function post(over: Partial<SocialPostRow> = {}): SocialPostRow {
  return {
    platform: "instagram",
    platformPostId: "1",
    ownerUsername: "p3t3rango",
    isOwnPost: true,
    caption: "post",
    url: "https://www.instagram.com/p/1/",
    postedAt: "2026-01-01T00:00:00.000Z",
    likeCount: 10,
    commentCount: 1,
    playCount: null,
    hashtags: [],
    mentions: [],
    coauthors: [],
    musicTitle: null,
    musicArtist: null,
    ...over,
  };
}

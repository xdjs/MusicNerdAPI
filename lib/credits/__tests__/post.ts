import type { SocialPostRow } from "@/lib/instagram/types";

export const POST_URL = "https://www.instagram.com/p/DScwWGzkYcJ/";
export const OTHER_URL = "https://www.instagram.com/p/DIT-FmFRvK7/";
export const ARTIST = "Pharaoh Sistare";
export const HANDLE = "pharaohsistare";

/**
 * A stored post from Pharaoh Sistare's feed, for fixtures.
 *
 * @param over - Fields to override.
 * @returns The post.
 */
export function post(over: Partial<SocialPostRow> = {}): SocialPostRow {
  return {
    platform: "instagram",
    platformPostId: "1",
    ownerUsername: "pharaohsistare",
    isOwnPost: true,
    caption:
      "Enjoy 💚\n\nMixing & Mastering Engineer: @p3t3rango\nWritten & Produced by: Pharaoh Sistare",
    url: POST_URL,
    postedAt: "2025-12-19T15:00:00.000Z",
    likeCount: 100,
    commentCount: 5,
    playCount: null,
    hashtags: [],
    mentions: ["p3t3rango"],
    coauthors: [],
    musicTitle: null,
    musicArtist: null,
    ...over,
  };
}

/**
 * A raw credit as the model would return it.
 *
 * @param over - Fields to override.
 * @returns The raw credit.
 */
export function credit(over: Record<string, unknown> = {}) {
  return {
    subject: "p3t3rango",
    isHandle: true,
    role: "Mixing & Mastering Engineer",
    quote: "Mixing & Mastering Engineer: @p3t3rango",
    url: POST_URL,
    ...over,
  };
}

/**
 * A numbered own post with one "Mixed by @someone" credit, for slicing tests.
 *
 * @param i - The post number.
 * @returns The post.
 */
export function numberedPost(i: number): SocialPostRow {
  return post({
    platformPostId: String(i),
    ownerUsername: "artist",
    caption: `Post number ${i}. Mixed by @someone on this one.`,
    url: `https://www.instagram.com/p/POST${i}/`,
    postedAt: "2026-01-01T00:00:00.000Z",
    mentions: ["someone"],
  });
}

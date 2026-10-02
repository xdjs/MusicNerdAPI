/** Mirrors the `artist_social_posts` insert shape (see lib/db/schema.ts). */
export interface SocialPostInsert {
  artistId: string;
  platform: string;
  platformPostId: string;
  ownerUsername: string;
  isOwnPost: boolean;
  caption: string | null;
  url: string;
  postedAt: string | null;
  likeCount: number | null;
  commentCount: number | null;
  playCount: number | null;
  hashtags: string[];
  mentions: string[];
  coauthors: string[];
  musicTitle: string | null;
  musicArtist: string | null;
  raw: unknown;
}

export interface IngestResult {
  ingested: number;
  ownPosts: number;
  collabPosts: number;
  /** Durable collection cursor: present until all thumbnail batches are stored. */
  nextCursor?: number;
}

export type ApifyRunState =
  | { status: "started"; runId: string }
  | { status: "running"; runId: string }
  | { status: "ready"; runId: string; datasetId: string }
  | { status: "failed"; reason: string; retryable?: boolean };

/** Paths a job tried to upload, so a revoked job can remove its own late uploads. */
export type ThumbnailUploadScope = { jobId: string; attemptedPaths: Set<string> };

/** One raw item from the apify/instagram-scraper dataset. Every field is untrusted. */
export interface ApifyPost {
  id?: unknown;
  url?: unknown;
  ownerUsername?: unknown;
  caption?: unknown;
  hashtags?: unknown;
  mentions?: unknown;
  taggedUsers?: unknown;
  coauthorProducers?: unknown;
  likesCount?: unknown;
  commentsCount?: unknown;
  videoPlayCount?: unknown;
  timestamp?: unknown;
  musicInfo?: unknown;
  error?: unknown;
}

export interface ApifyMusicInfo {
  artist_name?: unknown;
  song_name?: unknown;
  uses_original_audio?: unknown;
}

/** A stored post, in the shape the caption reader and the Lore's social signals read. */
export interface SocialPostRow {
  platform: string;
  platformPostId: string;
  ownerUsername: string;
  isOwnPost: boolean;
  caption: string | null;
  url: string;
  /** ISO 8601; "" when the post has no date. */
  postedAt: string;
  likeCount: number | null;
  commentCount: number | null;
  playCount: number | null;
  hashtags: string[];
  mentions: string[];
  coauthors: string[];
  musicTitle: string | null;
  musicArtist: string | null;
}

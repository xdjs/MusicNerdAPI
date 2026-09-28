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
  | { status: "failed"; reason: string };

/** Paths a job tried to upload, so a revoked job can remove its own late uploads. */
export type ThumbnailUploadScope = { jobId: string; attemptedPaths: Set<string> };

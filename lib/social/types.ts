export type ProfilePlatform = "tiktok" | "x";
export type SocialSource = ProfilePlatform | "reels";
export type ReelTarget = { id: string; url: string; owner: string };
export type SocialTask = {
  source: SocialSource;
  handle: string;
  reels?: ReelTarget[];
  runId?: string;
  /** Saved before the POST: an ambiguous timeout must never start another paid run. */
  startRequested?: boolean;
  datasetId?: string;
  attempts?: number;
  status?: "checked" | "failed";
  stored?: number;
  failure?: string;
};
export type AdditionalSocialState = { tasks: SocialTask[]; index: number };
export const SOCIAL_ACTORS = {
  tiktok: "clockworks~tiktok-scraper",
  x: "apidojo~tweet-scraper",
  reels: "apify~instagram-reel-scraper",
} as const;
/** TikTok rejects run caps below $0.50, even when fewer items cost less. */
export const SOCIAL_CHARGE_CAPS = { tiktok: 0.5, x: 0.05, reels: 0.5 } as const;
export const SOCIAL_POST_LIMIT = 50;
export const REEL_LIMIT = 3;
export const MAX_TRANSCRIPT_CHARS = 12_000;

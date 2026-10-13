export type RefreshPlatform = "instagram" | "tiktok" | "x";
export type SocialScan = {
  startedAt: string;
  scope?: "latest" | "profile";
  after?: string;
  skip?: boolean;
  checkedAt?: string;
  providerLimited?: boolean;
};
export type RefreshCheckpoint = { coveredThrough: string | null; checkedAt: string };

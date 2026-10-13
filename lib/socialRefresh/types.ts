export type RefreshPlatform = "instagram" | "tiktok" | "x";
export type SocialScan = {
  startedAt: string;
  scope?: "latest" | "profile";
  after?: string;
  skip?: boolean;
  checkedAt?: string;
  providerLimited?: boolean;
  reference?: ScanReference;
};
export type RefreshCheckpoint = {
  coveredThrough: string | null;
  checkedAt: string;
  reference?: ScanReference;
};
export type ScanAnchor = { id: string; postedAt: string };
export type ScanReference = { anchors: ScanAnchor[]; observedAt: string; gapSince: string | null };
export type ScanPost = ScanAnchor & { pinned?: boolean };

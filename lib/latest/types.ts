import type { SocialScan } from "@/lib/socialRefresh/types";
/** Update Latest's sources, in the order the editor view lists them. */
export const LATEST_SOURCES = [
  "instagram",
  "inprocess",
  "spotify",
  "deezer",
  "interviews",
] as const;
export type LatestSource = (typeof LATEST_SOURCES)[number];

export type SourceResult = {
  status: "pending" | "checked" | "failed" | "disconnected";
  checkedAt?: string;
  detail?:
    | "posts_imported"
    | "older_posts_found"
    | "no_new_posts"
    | "instagram_unavailable"
    | "verifying_empty_window";
};

/** A `latest_refresh` job's state, as MusicNerdWeb's Update Latest request writes it. */
export type LatestRefreshState = {
  claimId: string | null;
  userId: string;
  instagram?: string;
  inprocess?: string;
  spotify?: string;
  deezer?: string;
  sources: Record<LatestSource, SourceResult>;
  /** Private diagnostic, excluded from the editor response. */
  instagramFailure?: { phase: "status" | "collection"; reason: string; at: string };
  /** Private audit of the single permitted unfiltered verification. */
  instagramVerification?: { originalRunId: string; originalDatasetId: string; after: string };
  instagramObservation?: {
    outcome: "posts_imported" | "older_posts_found" | "no_new_posts";
    checkedAt: string;
    after?: string;
    newestPostAt?: string;
  };
  scan?: SocialScan;
  providerStarted?: boolean;
  runId?: string;
  datasetId?: string;
};

/** The private editor view of a Latest request, as `getLatestRefresh` returns it. */
export type LatestRefreshView = {
  id: string;
  status: string;
  requestedAt: string;
  sources: Partial<Record<LatestSource, SourceResult>>;
  retryAt: string;
};

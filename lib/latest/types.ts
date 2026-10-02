/** Update Latest's sources. MusicNerdWeb checks every one but Instagram inline. */
export type LatestSource = "instagram" | "inprocess" | "spotify" | "deezer" | "interviews";

export type SourceResult = {
  status: "pending" | "checked" | "failed" | "disconnected";
  checkedAt?: string;
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
  providerStarted?: boolean;
  runId?: string;
  datasetId?: string;
};

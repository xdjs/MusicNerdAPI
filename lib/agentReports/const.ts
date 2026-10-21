/** What a worker may report in a heartbeat. */
export const HEARTBEAT_STATUSES = ["starting", "running", "idle", "error", "stopping"] as const;

/** What a worker may report for a run. */
export const RUN_STATUSES = ["running", "success", "failed"] as const;

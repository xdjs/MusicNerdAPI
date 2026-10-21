import type { HEARTBEAT_STATUSES, RUN_STATUSES } from "@/lib/agentReports/const";

/** A worker's heartbeat, after validation. */
export type HeartbeatBody = {
  workerId: string;
  status: (typeof HEARTBEAT_STATUSES)[number];
  currentRun?: number;
  batchPlatform?: string;
  batchSize?: number;
  message?: string;
  config?: Record<string, unknown>;
};

/** A worker's run report, after validation. */
export type RunReportBody = {
  workerId: string;
  runNumber: number;
  status: (typeof RUN_STATUSES)[number];
  startedAt: string;
  platform?: string;
  endedAt?: string;
  wallTimeSecs?: number;
  claudeTimeSecs?: number;
  apiTimeSecs?: number;
  turns?: number;
  batchSize?: number;
  resolved?: number;
  excluded?: number;
  skipped?: number;
  errors?: number;
  highConfidence?: number;
  mediumConfidence?: number;
  conflicts?: number;
  nameMismatches?: number;
  tooAmbiguous?: number;
  exitCode?: number;
  failCategory?: string;
  failReason?: string;
};

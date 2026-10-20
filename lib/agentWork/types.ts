export interface AuditLogEntry {
  id: string;
  artistId: string;
  artistName: string | null;
  field: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  agentLabel: string | null;
  createdAt: string;
}

export interface ActivityPulse {
  lastWriteAt: string | null;
  rateLastHour: number;
}

export interface HourlyActivityBucket {
  hour: string;
  resolveCount: number;
  excludeCount: number;
}

export interface AgentBreakdownRow {
  label: string | null;
  apiKeyHash: string;
  resolvedCount: number;
  excludedCount: number;
  lastActiveAt: string | null;
  byConfidence: { high: number; medium: number; low: number; manual: number };
  bySource: {
    wikidata: number;
    musicbrainz: number;
    name_search: number;
    web_search: number;
    manual: number;
  };
}

export interface MappingStats {
  totalArtistsWithSpotify: number;
  totalArtistsWithDeezer: number;
  platformStats: { platform: string; mappedCount: number; percentage: number }[];
}

export interface MappingExclusion {
  id: string;
  artistId: string;
  artistName: string | null;
  spotify: string | null;
  platform: string;
  reason: string;
  details: string | null;
  createdAt: string;
}

export interface WorkerHeartbeat {
  workerId: string;
  apiKeyHash: string;
  status: string;
  computedStatus: "running" | "idle" | "stopped" | "error" | "dead";
  currentRun: number | null;
  batchPlatform: string | null;
  batchSize: number | null;
  message: string | null;
  startedAt: string;
  updatedAt: string;
  config: Record<string, unknown> | null;
}

export interface AgentRun {
  workerId: string;
  runNumber: number;
  platform: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  wallTimeSecs: number | null;
  claudeTimeSecs: number | null;
  apiTimeSecs: number | null;
  turns: number | null;
  batchSize: number | null;
  resolved: number;
  excluded: number;
  skipped: number;
  errors: number;
  highConfidence: number;
  mediumConfidence: number;
  conflicts: number;
  nameMismatches: number;
  tooAmbiguous: number;
  exitCode: number | null;
  failCategory: string | null;
  failReason: string | null;
}

export interface AgentWorkSummary {
  stats: MappingStats & {
    platformStats: (MappingStats["platformStats"][number] & { todayCount: number })[];
  };
  activityPulse: ActivityPulse;
  hourlyActivity: HourlyActivityBucket[];
  workers: WorkerHeartbeat[];
}

export interface AgentWorkDetails {
  auditLog: { entries: AuditLogEntry[]; total: number; page: number; limit: number };
  agentBreakdown: { agents: AgentBreakdownRow[] };
  exclusions: { platforms: Record<string, { exclusions: MappingExclusion[]; total: number }> };
  runHistory: { runs: AgentRun[]; total: number };
}

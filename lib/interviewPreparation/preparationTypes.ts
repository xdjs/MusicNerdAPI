import type { generateApiInterviewQuestion } from "./generateApiInterviewQuestion";
export type StageCache = Record<string, unknown>;
export type PreparedCandidate = Awaited<ReturnType<typeof generateApiInterviewQuestion>>;
export type PreparationState = {
  version: 1;
  totalCount?: number;
  bank?: Array<{
    candidate: PreparedCandidate;
    status: "available" | "offered" | "invalid";
    ordinal?: number;
    answerId?: string;
  }>;
  bankComplete?: boolean;
  batchOffered?: boolean;
  interviewInvalidated?: boolean;
  claimId: string;
  userId: string;
  sessionId: string;
  sitting: number;
  ordinal: number;
  memorySnapshotId: string;
  stage: "preparing" | "ready" | "failed" | "stale" | "consumed";
  cache: StageCache;
  inFlight: boolean;
  createdAt: string;
  candidate?: PreparedCandidate;
  errorCode?:
    | "preparation_failed"
    | "model_output_invalid"
    | "timeout_or_cancelled"
    | "external_outcome_unknown";
};

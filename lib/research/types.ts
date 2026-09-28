export type JobKind = "social_ingest" | "caption_extract" | "lore_refresh";
export type JobStatus = "pending" | "running" | "done" | "failed";

export interface ResearchJob {
  id: string;
  artistId: string;
  kind: JobKind;
  status: JobStatus;
  cursor: number;
  total: number | null;
  attempts: number;
  state: Record<string, unknown>;
  updatedAt: string | null;
}

/** What one slice did. `ran: false` means the queue was empty, the normal case. */
export interface AdvanceResult {
  ran: boolean;
  jobId?: string;
  /** The slice is waiting on something outside us (an Apify run); skip it for the rest of the tick. */
  waiting?: boolean;
  kind?: string;
  artistId?: string;
  progress?: string;
  done?: boolean;
}

/** What a job-kind runner reports back to `advanceResearch`. */
export interface SliceOutcome {
  progress: string;
  done: boolean;
  waiting?: boolean;
}

import type { CaptionExtraction } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";

export type EvidenceKind = "post" | "transcript" | "lore" | "answer" | "correction";
export interface InterviewEvidence {
  id: string;
  title?: string;
  metadata?: {
    musicTitle: string | null;
    musicArtist: string | null;
    coauthors: string[];
    mentions: string[];
  };
  group: string;
  kind: EvidenceKind;
  text: string;
  url: string | null;
  attribution: "artist" | "source author" | "speaker unverified";
  publishedAt: string | null;
  availableAt: string;
}
export interface InterviewCorpus {
  version: 1;
  capturedAt: string;
  exclusions?: { id: string; reason: string }[];
  environment?: "production" | "staging";
  artist: { id: string; name: string; instagram: string | null };
  evidence: InterviewEvidence[];
  baseline: { posts: SocialPostRow[]; extraction: CaptionExtraction };
}
export type ExperimentArm = "signals" | "context" | "connections";
export interface EvidenceQuote {
  evidenceId: string;
  quote: string;
}
export interface InterviewDraft {
  question: string;
  whyAsk: string;
  unknown: string;
  evidence: EvidenceQuote[];
}
export interface InterviewVerdict {
  index: number;
  supported: boolean;
  attributionCorrect: boolean;
  respectsCorrections: boolean;
  notAlreadyAnswered: boolean;
  worthwhile: boolean;
  reason: string;
}
export interface ExperimentCall {
  stage: string;
  elapsedMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  promptBytes: number;
}
export interface ExperimentResult {
  arm: ExperimentArm;
  model: string;
  corpusHash: string;
  asOf: string;
  questions: InterviewDraft[];
  rejected: { draft: InterviewDraft; reason: string }[];
  calls: ExperimentCall[];
  evidenceIds: string[];
  searches: string[];
}

export interface CorpusRows {
  artist: { id: string; name: string; instagram: string | null };
  posts: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  corrections: Record<string, unknown>[];
  credits: Record<string, unknown>[];
}

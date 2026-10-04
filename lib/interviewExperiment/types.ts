import type { CaptionExtraction } from "@/lib/credits/types";
import type { SocialPostRow } from "@/lib/instagram/types";

export type EvidenceKind = "post" | "transcript" | "lore" | "answer" | "correction";
export interface InterviewEvidence {
  id: string;
  range?: { sourceId: string; start: number; end: number; totalChars: number };
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
export type ExperimentArm = "signals" | "context" | "connections" | "prepared";
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
  preparation?: {
    purpose: string;
    dossier: InterviewDossier;
    context: InterviewEvidence[];
    omittedIds: string[];
    memoryDocuments: { sourceId: string; characters: number }[];
    memoryCalls: ExperimentCall[];
    conversation: InterviewConversation | null;
    withheldIds: string[];
    review?: {
      index: number;
      reason: string;
      premises: { claim: string; status: string; reason: string }[];
    }[];
  };
}

export interface InterviewMemory {
  version: 1;
  promptVersion: "reading-v1";
  artistId: string;
  corpusHash: string;
  asOf: string;
  model: string;
  documents: { sourceId: string; characters: number }[];
  sections: {
    sourceId: string;
    start: number;
    end: number;
    notes: { kind: string; point: string; quote: string }[];
    rejectedNotes?: { point: string; quote: string }[];
    call: ExperimentCall;
  }[];
}
export interface InterviewConversation {
  kind: "synthetic" | "published";
  artistId: string;
  label?: string;
  sourceId?: string;
  turns: { speaker: "interviewer" | "artist"; text: string; start?: number; end?: number }[];
}
export interface InterviewDossier {
  alreadyExplained: { observation: string; evidence: EvidenceQuote[] }[];
  angles: {
    observation: string;
    unknown: string;
    whyAsk: string;
    assumptionsToAvoid: string[];
    evidence: EvidenceQuote[];
  }[];
  discarded: string[];
  gaps: string[];
}

export interface CorpusRows {
  artist: { id: string; name: string; instagram: string | null };
  posts: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  corrections: Record<string, unknown>[];
  credits: Record<string, unknown>[];
}

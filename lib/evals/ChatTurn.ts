import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

/** One chat turn as the suite scores it, whichever target produced it. */
export type ChatTurn = {
  answer: string;
  /** The sources returned with the answer; `n` is the number its `[n]` markers use. */
  sources: { n: number; title: string; url: string }[];
  /** From the question being sent to the first answer text the client could show. */
  firstTextMs: number;
  /** Exact public tool passages seen by the model; absent on historical turns. */
  evidence?: ChatEvidence[];
  /** Successful read inventory, including native PDFs with no complete textual capture. */
  /** Legacy compatibility summary; never replaces the structured capture inventory. */
  evidenceCaptureComplete?: boolean;
  capture?: {
    complete: boolean;
    reads: {
      toolCallId: string;
      tool: "readSource" | "webSearch" | "readPdfSource" | "readNamedPdf";
      complete: boolean;
      totalPages?: number;
      sourceId?: string;
      revision?: string;
      originalSha256?: string;
    }[];
  };
  /** Literal presentation is separate from generated prose and its citation syntax. */
  attribution?: {
    state: string;
    passages: import("@/lib/attributedChat/types").Passage[];
    pdfTextUnavailable: boolean;
  };
  /** First substantive literal passage, never a fixed progress notice. */
  firstPassageMs?: number;
  /** From the question being sent to the finished answer. */
  totalMs: number;
  /** Set when the turn ended in an error response instead of an answer. */
  error?: string;
};

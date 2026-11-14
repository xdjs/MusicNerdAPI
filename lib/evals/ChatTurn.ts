import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

/** One chat turn as the suite scores it, whichever target produced it. */
export type ChatTurn = {
  answer: string;
  /** The sources returned with the answer; `n` is the number its `[n]` markers use. */
  sources: { n: number; title: string; url: string }[];
  /** From the question being sent to the first answer text the client could show. */
  firstTextMs: number;
  /**
   * From the question being sent to the first part the artist page can show anything for:
   * a tool step (its progress line) or answer text, whichever comes first. Absent on
   * historical turns.
   */
  firstSignalMs?: number;
  /** Exact public tool passages seen by the model; absent on historical turns. */
  evidence?: ChatEvidence[];
  /** The tools the model called, in order, with their inputs; absent on historical turns. */
  tools?: { name: string; input: unknown; toolCallId?: string }[];
  /**
   * A text-free trace of each tool call in call order: `atMs` is when its input was available
   * and `doneMs` when its output arrived (both since the turn started); `summary` holds counts
   * and flags only. Absent on historical turns.
   */
  trace?: { name: string; atMs: number; doneMs?: number; summary: string }[];
  /** Model steps in the turn, counted from the stream's `start-step` parts. */
  steps?: number;
  /** This answer as a client sends it back in a follow-up: completed PDF reads and the text. */
  assistantParts?: unknown[];
  /** From the question being sent to the finished answer. */
  totalMs: number;
  /** Set when the turn ended in an error response instead of an answer. */
  error?: string;
  /** With `error`, when the staging question allowance that refused the turn reopens. */
  retryAfterSeconds?: number;
};

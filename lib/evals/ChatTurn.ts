/** One chat turn as the suite scores it, whichever target produced it. */
export type ChatTurn = {
  answer: string;
  /** The sources returned with the answer; `n` is the number its `[n]` markers use. */
  sources: { n: number; title: string; url: string }[];
  /** From the question being sent to the first answer text the client could show. */
  firstTextMs: number;
  /** From the question being sent to the finished answer. */
  totalMs: number;
  /** Set when the turn ended in an error response instead of an answer. */
  error?: string;
};

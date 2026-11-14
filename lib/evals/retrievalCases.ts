import { CHAT_CASES } from "@/lib/evals/chatCases";
import { RETRIEVAL_LABELS, type RetrievalFact } from "@/lib/evals/retrievalLabels";

export type { ExpectedUnit, RetrievalFact } from "@/lib/evals/retrievalLabels";

/** One retrieval-suite question: the chat suite's, with the units a search should surface. */
export type RetrievalCase = {
  key: string;
  /** STAGING artist id, as in `chatCases.ts`. */
  artistId: string;
  artistName: string;
  question: string;
  /** False when the stored sources cannot answer it: the right search is weak and returns nothing worth reading. */
  answerable: boolean;
  /**
   * The facts that answer the question, each found when any one of its units is retrieved
   * (`retrievalLabels.ts`). Empty for the unanswerable case, which never gates.
   */
  facts: RetrievalFact[];
  /** What the case tests, plus known PDF page numbers. */
  note: string;
  /** A second question asked as its own row; labelled on its own. */
  followUp?: { question: string; facts: RetrievalFact[]; note: string };
};

/** Page numbers `chatCases.ts` records for the Dutchyyy discography timeline PDF, as context for the labels. */
const PDF_PAGES: Record<string, string> = {
  "dutchyyy-aliases":
    "Known PDF pages: 1 (overview of the three aliases), 2 (The Chill Factor, 2001).",
  "dutchyyy-alias-years":
    "Known PDF pages: 1 (overview), 2 (The Chill Factor), 4, 5 (2007 production credit), 7 (Blue Screen of Deaf), 8 (Astral Basement), 10 (RawSauce Remix), 11 (The Reluctant Clap).",
};

/**
 * The twelve chat questions plus the #118 follow-up, for measuring what the text index returns
 * before any model reads it, with the facts each should surface (`retrievalLabels.ts`).
 */
export const RETRIEVAL_CASES: RetrievalCase[] = CHAT_CASES.map(c => ({
  key: c.key,
  artistId: c.artistId,
  artistName: c.artistName,
  question: c.question,
  answerable: c.answerable,
  facts: RETRIEVAL_LABELS[c.key] ?? [],
  note: PDF_PAGES[c.key] ? `${c.note} ${PDF_PAGES[c.key]}` : c.note,
  ...(c.followUp
    ? {
        followUp: {
          question: c.followUp.question,
          facts: RETRIEVAL_LABELS[`${c.key}/follow-up`] ?? [],
          note: "Known PDF page: 1 (the timeline's overview of the producer alias).",
        },
      }
    : {}),
}));

import { CHAT_CASES } from "@/lib/evals/chatCases";
import type { UnitSourceKind } from "@/lib/units/types";

/** One unit a good search returns: a source and the page (or chunk) locator within it. */
export type ExpectedUnit = { sourceKind: UnitSourceKind; sourceId: string; locator: string };

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
   * Units that answer the question; empty until labelled (the suite still runs and scores 0
   * recall there, and unlabelled cases never gate). Source ids are UUIDs, not secrets.
   */
  expected: ExpectedUnit[];
  /** What the case tests, plus known page numbers where the source id is not yet labelled. */
  note: string;
  /** A second question asked as its own row; labelled on its own. */
  followUp?: { question: string; expected: ExpectedUnit[]; note: string };
};

/** Page numbers `chatCases.ts` records for the Dutchyyy discography timeline PDF, kept until its source id is labelled. */
const PDF_PAGES: Record<string, string> = {
  "dutchyyy-aliases":
    "Known PDF pages: 1 (overview of the three aliases), 2 (The Chill Factor, 2001).",
  "dutchyyy-alias-years":
    "Known PDF pages: 1 (overview), 2 (The Chill Factor), 4, 5 (2007 production credit), 7 (Blue Screen of Deaf), 8 (Astral Basement), 10 (RawSauce Remix), 11 (The Reluctant Clap).",
};

/**
 * The twelve chat questions plus the #118 follow-up, for measuring what the text index returns
 * before any model reads it. Labels are written by the labelling run (`RETRIEVAL_LABEL=1`, see
 * `docs/chat-eval-pdf-evidence.md`) and confirmed by Pete.
 */
export const RETRIEVAL_CASES: RetrievalCase[] = CHAT_CASES.map(c => ({
  key: c.key,
  artistId: c.artistId,
  artistName: c.artistName,
  question: c.question,
  answerable: c.answerable,
  expected: [],
  note: PDF_PAGES[c.key] ? `${c.note} ${PDF_PAGES[c.key]}` : c.note,
  ...(c.followUp
    ? {
        followUp: {
          question: c.followUp.question,
          expected: [],
          note: "Known PDF page: 1 (the timeline's overview of the producer alias).",
        },
      }
    : {}),
}));

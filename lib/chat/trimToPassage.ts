import { ENGLISH_STOPWORDS, PASSAGE_CHARS } from "@/lib/units/types";

/** Context kept before the term occurrence a candidate window starts from. */
const PASSAGE_LEAD = Math.floor(PASSAGE_CHARS / 4);

/** The most distinct query terms considered; the query comes from the model. */
const MAX_TERMS = 16;

/** The most term occurrences collected from one unit, over all terms; each term gets an equal share. */
const MAX_OCCURRENCES = 400;

/** The most candidate windows scored for one unit. */
const MAX_CANDIDATES = 200;

type Occurrence = { at: number; end: number; term: number };

/**
 * A search hit's text as the model sees it. A unit of at most `PASSAGE_CHARS` is returned whole.
 * A longer one (a dense PDF page, up to `MAX_PAGE_CHARS`) is cut to the `PASSAGE_CHARS` window
 * holding the most distinct query terms, ties going to the earliest window. Terms are the first 16
 * distinct letter and digit tokens of three or more characters in the query that are not English
 * stopwords, matched case-insensitively and without overlap anywhere in the text; at most 400
 * occurrences are collected, no term contributing more than its share of them (400 divided by
 * the number of terms, rounded up). Each candidate window starts `PASSAGE_LEAD` before an occurrence, kept
 * inside the text; when there are more than 200 candidates, 200 evenly spaced ones are scored, in
 * one sweep over the occurrences. With no term in the text the window starts at 0.
 *
 * @param text - The unit's text.
 * @param query - The search query.
 * @returns The passage: the whole text, or one `PASSAGE_CHARS` slice of it.
 */
export function trimToPassage(text: string, query: string): string {
  if (text.length <= PASSAGE_CHARS) return text;
  const lower = text.toLowerCase();
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter(w => w.length >= 3 && !ENGLISH_STOPWORDS.has(w)))].slice(
    0,
    MAX_TERMS,
  );
  const occurrences: Occurrence[] = [];
  // Each term has its own cap, so one frequent term cannot crowd out the rest.
  const perTerm = Math.ceil(MAX_OCCURRENCES / Math.max(1, terms.length));
  for (const [i, term] of terms.entries()) {
    let taken = 0;
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) {
      if (taken === perTerm || occurrences.length === MAX_OCCURRENCES) break;
      occurrences.push({ at, end: at + term.length, term: i });
      taken++;
    }
  }
  if (occurrences.length === 0) return text.slice(0, PASSAGE_CHARS);
  const last = text.length - PASSAGE_CHARS;
  const starts = [
    ...new Set(occurrences.map(o => Math.max(0, Math.min(o.at - PASSAGE_LEAD, last)))),
  ].sort((a, b) => a - b);
  const step = Math.max(1, starts.length / MAX_CANDIDATES);
  // A window holds an occurrence that starts at or after it and ends inside it. As windows move
  // right, occurrences join in order of their end and leave in order of their start; one shorter
  // than the window always joins before it leaves.
  const byEnd = [...occurrences].sort((a, b) => a.end - b.end);
  const byStart = [...occurrences].sort((a, b) => a.at - b.at);
  const counts = new Map<number, number>();
  let joined = 0;
  let left = 0;
  let best = { start: 0, score: -1 };
  for (let i = 0; i < starts.length; i += step) {
    const start = starts[Math.floor(i)];
    for (; joined < byEnd.length && byEnd[joined].end <= start + PASSAGE_CHARS; joined++)
      counts.set(byEnd[joined].term, (counts.get(byEnd[joined].term) ?? 0) + 1);
    for (; left < byStart.length && byStart[left].at < start; left++) {
      const term = byStart[left].term;
      const n = counts.get(term)! - 1;
      if (n === 0) counts.delete(term);
      else counts.set(term, n);
    }
    // Strictly greater, so a tie keeps the earlier window.
    if (counts.size > best.score) best = { start, score: counts.size };
  }
  return text.slice(best.start, best.start + PASSAGE_CHARS);
}

import { ENGLISH_STOPWORDS, PASSAGE_CHARS } from "@/lib/units/types";

/** Context kept before the term occurrence a candidate window starts from. */
const PASSAGE_LEAD = Math.floor(PASSAGE_CHARS / 4);

/** The most candidate windows scored for one unit. */
const MAX_CANDIDATES = 200;

/**
 * A search hit's text as the model sees it. A unit of at most `PASSAGE_CHARS` is returned whole.
 * A longer one (a dense PDF page, up to `MAX_PAGE_CHARS`) is cut to the `PASSAGE_CHARS` window
 * holding the most distinct query terms, ties going to the earliest window. Terms are the query's
 * letter and digit tokens of three or more characters that are not English stopwords, matched
 * case-insensitively anywhere in the text. Each candidate window starts `PASSAGE_LEAD` before an
 * occurrence of a term, kept inside the text; when there are more than 200 candidates, 200 evenly
 * spaced ones are scored. With no term in the text the window starts at 0.
 *
 * @param text - The unit's text.
 * @param query - The search query.
 * @returns The passage: the whole text, or one `PASSAGE_CHARS` slice of it.
 */
export function trimToPassage(text: string, query: string): string {
  if (text.length <= PASSAGE_CHARS) return text;
  const lower = text.toLowerCase();
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter(w => w.length >= 3 && !ENGLISH_STOPWORDS.has(w)))];
  const occurrences: { at: number; end: number; term: number }[] = [];
  terms.forEach((term, i) => {
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + 1))
      occurrences.push({ at, end: at + term.length, term: i });
  });
  if (occurrences.length === 0) return text.slice(0, PASSAGE_CHARS);
  const last = text.length - PASSAGE_CHARS;
  const starts = [
    ...new Set(occurrences.map(o => Math.max(0, Math.min(o.at - PASSAGE_LEAD, last)))),
  ].sort((a, b) => a - b);
  const step = Math.max(1, starts.length / MAX_CANDIDATES);
  let best = { start: 0, score: -1 };
  for (let i = 0; i < starts.length; i += step) {
    const start = starts[Math.floor(i)];
    const end = start + PASSAGE_CHARS;
    const inside = new Set(occurrences.filter(o => o.at >= start && o.end <= end).map(o => o.term));
    // Strictly greater, so a tie keeps the earlier window.
    if (inside.size > best.score) best = { start, score: inside.size };
  }
  return text.slice(best.start, best.start + PASSAGE_CHARS);
}

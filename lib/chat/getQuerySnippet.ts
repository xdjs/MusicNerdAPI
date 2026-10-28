/**
 * The passage of a stored source that best matches a search: the window holding the
 * most distinct query words (of four letters or more), or the start of the text when none
 * appear. Lets the model see which source answers before it reads one.
 *
 * @param text - The source's stored text.
 * @param query - The model's search query.
 * @param chars - The snippet length.
 * @returns At most `chars` characters of `text`.
 */
export function getQuerySnippet(text: string, query: string, chars: number): string {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])];
  const lower = text.toLowerCase();
  // A little context before the first matching word.
  const lead = Math.floor(chars / 5);
  let best = { start: 0, hits: 0 };
  for (const term of terms) {
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + 1)) {
      const start = Math.max(0, at - lead);
      const window = lower.slice(start, start + chars);
      const hits = terms.filter(t => window.includes(t)).length;
      if (hits > best.hits) best = { start, hits };
    }
  }
  return text.slice(best.start, best.start + chars).trim();
}

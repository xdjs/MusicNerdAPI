import type { UIMessageStreamWriter } from "ai";

export type CiteSource = (source: { url: string; title: string }) => number;

/**
 * Numbers a chat turn's sources 1, 2, … in order of first use and writes one
 * `source-url` part per source, so the answer's `[n]` markers match the
 * part's `sourceId`.
 *
 * @param writer - The chat response's writer.
 * @param seed - Sources numbered in earlier turns: each fixes `url` to `n` and writes its part now; new numbers continue after the highest `n`, leaving any gaps as gaps. A repeated pairing is ignored; one URL under two numbers, or one number for two URLs, throws.
 * @param highestCited - The highest number earlier answers cited (`keepCurrentCitedTurns`); new numbers also start above it, so a number from an earlier turn (a web result, say) never comes back meaning another source.
 * @returns `cite`, which returns a source's number.
 */
export function createChatCitations(
  writer: UIMessageStreamWriter,
  seed: { n: number; url: string; title: string }[] = [],
  highestCited = 0,
): CiteSource {
  const numbers = new Map<string, number>();
  let highest = highestCited;
  const assign = (n: number, url: string, title: string) => {
    numbers.set(url, n);
    highest = Math.max(highest, n);
    writer.write({ type: "source-url", sourceId: String(n), url, title });
  };
  const seededUrls = new Map<number, string>();
  for (const { n, url, title } of seed) {
    const known = numbers.get(url);
    // A repeat of the same pairing is harmless; any other clash would renumber silently.
    if (known === n) continue;
    if (known !== undefined) throw new Error(`seed gives one URL both ${known} and ${n}`);
    if (seededUrls.has(n)) throw new Error(`seed gives ${n} to two sources`);
    seededUrls.set(n, url);
    assign(n, url, title);
  }
  return ({ url, title }) => {
    const known = numbers.get(url);
    if (known) return known;
    const n = highest + 1;
    assign(n, url, title);
    return n;
  };
}

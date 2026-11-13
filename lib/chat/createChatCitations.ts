import type { UIMessageStreamWriter } from "ai";

export type CiteSource = (source: { url: string; title: string }) => number;

/**
 * Numbers a chat turn's sources 1, 2, … in order of first use and writes one
 * `source-url` part per source, so the answer's `[n]` markers match the
 * part's `sourceId`.
 *
 * @param writer - The chat response's writer.
 * @param seed - Sources numbered in earlier turns: each fixes `url` to `n` and writes its part now; new numbers continue after the highest `n`, leaving any gaps as gaps.
 * @returns `cite`, which returns a source's number.
 */
export function createChatCitations(
  writer: UIMessageStreamWriter,
  seed: { n: number; url: string; title: string }[] = [],
): CiteSource {
  const numbers = new Map<string, number>();
  let highest = 0;
  const assign = (n: number, url: string, title: string) => {
    numbers.set(url, n);
    highest = Math.max(highest, n);
    writer.write({ type: "source-url", sourceId: String(n), url, title });
  };
  for (const { n, url, title } of seed) if (!numbers.has(url)) assign(n, url, title);
  return ({ url, title }) => {
    const known = numbers.get(url);
    if (known) return known;
    const n = highest + 1;
    assign(n, url, title);
    return n;
  };
}

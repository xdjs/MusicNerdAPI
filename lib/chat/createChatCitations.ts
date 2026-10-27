import type { UIMessageStreamWriter } from "ai";

export type CiteSource = (source: { url: string; title: string }) => number;

/**
 * Numbers a chat turn's sources 1, 2, … in order of first use and writes one
 * `source-url` part per source, so the answer's `[n]` markers match the
 * part's `sourceId`.
 *
 * @param writer - The chat response's writer.
 * @returns `cite`, which returns a source's number.
 */
export function createChatCitations(writer: UIMessageStreamWriter): CiteSource {
  const numbers = new Map<string, number>();
  return ({ url, title }) => {
    const known = numbers.get(url);
    if (known) return known;
    const n = numbers.size + 1;
    numbers.set(url, n);
    writer.write({ type: "source-url", sourceId: String(n), url, title });
    return n;
  };
}

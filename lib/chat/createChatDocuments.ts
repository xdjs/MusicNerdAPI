import type { UnitSourceKind } from "@/lib/units/types";
import type { CiteSource } from "./createChatCitations";

export type ChatDocumentRef = {
  sourceKind: UnitSourceKind;
  sourceId: string;
  revision: string;
  title: string;
  url: string | null;
};

export type ChatDocuments = {
  register(ref: ChatDocumentRef): number;
  get(n: number): ChatDocumentRef | undefined;
  all(): { n: number; ref: ChatDocumentRef }[];
};

/**
 * Numbers a chat's documents per `(sourceKind, sourceId)` on top of `cite`, so
 * a follow-up turn keeps `[n]` meaning the same document.
 *
 * @param cite - The turn's citation numbering; writes the `source-url` part.
 * @param prior - Documents numbered in earlier turns, re-registered first in ascending `n`.
 * @returns The registry.
 */
export function createChatDocuments(
  cite: CiteSource,
  prior: { n: number; ref: ChatDocumentRef }[] = [],
): ChatDocuments {
  const byKey = new Map<string, number>();
  const byNumber = new Map<number, ChatDocumentRef>();

  const register = (ref: ChatDocumentRef): number => {
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    const known = byKey.get(key);
    if (known) return known;
    const synthetic = `musicnerd://${ref.sourceKind}/${ref.sourceId}`;
    let n = cite({ url: ref.url ?? synthetic, title: ref.title });
    // Another document already holds this URL's number; cite by the synthetic URL instead.
    if (byNumber.has(n)) n = cite({ url: synthetic, title: ref.title });
    byKey.set(key, n);
    byNumber.set(n, ref);
    return n;
  };

  for (const { ref } of [...prior].sort((a, b) => a.n - b.n)) register(ref);

  return {
    register,
    get: n => byNumber.get(n),
    all: () => [...byNumber].map(([n, ref]) => ({ n, ref })).sort((a, b) => a.n - b.n),
  };
}

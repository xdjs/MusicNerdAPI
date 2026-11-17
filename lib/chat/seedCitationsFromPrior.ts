import type { ChatDocumentRef } from "@/lib/chat/createChatDocuments";

/**
 * The citation seed for `createChatCitations` that matches how `createChatDocuments` re-registers
 * `prior`: walked in ascending `n`, each document is seeded with its URL, or with
 * `musicnerd://<kind>/<id>` when it has none or an earlier prior document already holds that URL.
 * Every seeded URL is distinct, so each prior document gets back exactly its own number.
 *
 * @param prior - The documents earlier answers numbered (`keepCurrentCitedTurns`).
 * @returns The seed, in ascending `n`.
 */
export function seedCitationsFromPrior(
  prior: { n: number; ref: ChatDocumentRef }[],
): { n: number; url: string; title: string }[] {
  const used = new Set<string>();
  return [...prior]
    .sort((a, b) => a.n - b.n)
    .map(({ n, ref }) => {
      const url =
        ref.url === null || used.has(ref.url)
          ? `musicnerd://${ref.sourceKind}/${ref.sourceId}`
          : ref.url;
      used.add(url);
      return { n, url, title: ref.title };
    });
}

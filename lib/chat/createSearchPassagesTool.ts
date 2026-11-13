import { tool } from "ai";
import { z } from "zod";
import type { ChatDocumentRef, ChatDocuments } from "@/lib/chat/createChatDocuments";
import { searchUnits } from "@/lib/units/searchUnits";
import { PASSAGE_CHARS } from "@/lib/units/types";

/** Context kept before the first matching term. */
const PASSAGE_LEAD = Math.floor(PASSAGE_CHARS / 4);

/** `PASSAGE_CHARS` of `text` around the first case-insensitive match of any query word, else from the start. */
function trimToPassage(text: string, query: string): string {
  if (text.length <= PASSAGE_CHARS) return text;
  const lower = text.toLowerCase();
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const first = Math.min(
    Infinity,
    ...terms.map(term => lower.indexOf(term)).filter(at => at !== -1),
  );
  const start =
    first === Infinity
      ? 0
      : Math.max(0, Math.min(first - PASSAGE_LEAD, text.length - PASSAGE_CHARS));
  return text.slice(start, start + PASSAGE_CHARS);
}

/**
 * The chat's `searchPassages` tool: hybrid search over the artist's eligible units, each hit's
 * document numbered for citation (`documents.register`), each passage trimmed to `PASSAGE_CHARS`
 * around the first query word it contains.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @param opts.names - The artist's names, display name first.
 * @param opts.signal - Aborts the search.
 * @param opts.search - Replaces `searchUnits` in tests.
 * @returns The tool. Its `documents` lists every document this call numbered, so later turns can carry the numbers.
 */
export function createSearchPassagesTool(
  artistId: string,
  documents: ChatDocuments,
  opts: { names: string[]; signal?: AbortSignal; search?: typeof searchUnits },
) {
  const search = opts.search ?? searchUnits;
  return tool({
    description:
      "Search the artist's saved documents (vault files, their own posts, confirmed research) for passages that answer the question. Always search first. Each result is a passage from document n at a locator such as `p. 3`; cite it as [n, locator]. When `weak` is true nothing matched well: say what the documents don't cover rather than guessing.",
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      const { hits, weak } = await search(artistId, query, {
        names: opts.names,
        signal: opts.signal,
      });
      const registered = new Map<number, ChatDocumentRef>();
      const results = hits.map(hit => {
        const ref: ChatDocumentRef = {
          sourceKind: hit.sourceKind,
          sourceId: hit.sourceId,
          revision: hit.sourceRevision,
          title: hit.title ?? "Untitled",
          url: hit.url,
        };
        const n = documents.register(ref);
        if (!registered.has(n)) registered.set(n, documents.get(n) ?? ref);
        return {
          n,
          locator: hit.locator,
          title: ref.title,
          passage: trimToPassage(hit.text, query),
        };
      });
      return {
        results,
        weak,
        documents: [...registered].map(([n, ref]) => ({
          n,
          sourceKind: ref.sourceKind,
          sourceId: ref.sourceId,
          revision: ref.revision,
          title: ref.title,
          url: ref.url,
        })),
      };
    },
  });
}

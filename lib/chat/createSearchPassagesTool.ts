import { tool } from "ai";
import { z } from "zod";
import type { ChatDocumentRef, ChatDocuments } from "@/lib/chat/createChatDocuments";
import { searchUnits } from "@/lib/units/searchUnits";
import { PASSAGE_CHARS } from "@/lib/units/types";

/** Searches one answer may run; the fifth is refused. */
const MAX_SEARCHES = 4;

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
 * around the first query word it contains. At most four calls per answer; each returned passage is
 * charged to the answer's shared read budget (`Math.ceil(length / 4)` tokens), and results that no
 * longer fit are dropped, unnumbered, with `truncated: true`.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @param opts.names - The artist's names, display name first.
 * @param opts.signal - Aborts the search.
 * @param opts.search - Replaces `searchUnits` in tests.
 * @param opts.budget - Tokens left for reads in this answer, shared with `readUnits`.
 * @returns The tool. Its `documents` lists every document this call numbered, so later turns can carry the numbers.
 */
export function createSearchPassagesTool(
  artistId: string,
  documents: ChatDocuments,
  opts: {
    names: string[];
    signal?: AbortSignal;
    search?: typeof searchUnits;
    budget: { remainingTokens: number };
  },
) {
  const search = opts.search ?? searchUnits;
  let searches = 0;
  return tool({
    description:
      "Search the artist's saved documents (vault files, their own posts, confirmed research) for passages that answer the question. Always search first. Each result is a passage from document n at a locator such as `p.3`; cite it as [n, locator]. When `weak` is true nothing matched well: say what the documents don't cover rather than guessing.",
    inputSchema: z.object({ query: z.string().min(1).max(300) }),
    execute: async ({ query }) => {
      // Counted before the await, so parallel calls in one step cannot slip past the cap.
      if (++searches > MAX_SEARCHES)
        return { error: "Search limit reached for this answer", results: [], documents: [] };
      const { hits, weak } = await search(artistId, query, {
        names: opts.names,
        signal: opts.signal,
      });
      const registered = new Map<number, ChatDocumentRef>();
      const results: { n: number; locator: string; title: string; passage: string }[] = [];
      let truncated = false;
      for (const hit of hits) {
        const passage = trimToPassage(hit.text, query);
        const tokens = Math.ceil(passage.length / 4);
        if (tokens > opts.budget.remainingTokens) {
          truncated = true;
          break;
        }
        opts.budget.remainingTokens -= tokens;
        const ref: ChatDocumentRef = {
          sourceKind: hit.sourceKind,
          sourceId: hit.sourceId,
          revision: hit.sourceRevision,
          title: hit.title ?? "Untitled",
          url: hit.url,
        };
        const n = documents.register(ref);
        if (!registered.has(n)) registered.set(n, documents.get(n) ?? ref);
        results.push({ n, locator: hit.locator, title: ref.title, passage });
      }
      return {
        results,
        weak,
        truncated,
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

import { tool } from "ai";
import { z } from "zod";
import type { ChatDocumentRef, ChatDocuments } from "@/lib/chat/createChatDocuments";
import { countDocumentUnits } from "@/lib/units/countDocumentUnits";
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
 * longer fit are dropped, unnumbered, with `truncated: true`. Each listed document carries `units`,
 * how many units it has in the index now (one `countDocumentUnits` query per call), and `shown`, how
 * many of them this call returned, so the model can tell when it saw only part of a document.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @param opts.names - The artist's names, display name first.
 * @param opts.signal - Aborts the search.
 * @param opts.search - Replaces `searchUnits` in tests.
 * @param opts.count - Replaces `countDocumentUnits` in tests.
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
    count?: typeof countDocumentUnits;
    budget: { remainingTokens: number };
  },
) {
  const search = opts.search ?? searchUnits;
  const count = opts.count ?? countDocumentUnits;
  let searches = 0;
  return tool({
    description:
      "Search the artist's saved documents (vault files, their own posts, confirmed research) for passages that answer the question. Always search first. Each result is a passage from document n at a locator such as `p.3`; cite it as [n, locator]. Each document lists how many of its units were shown (`shown`) out of its total (`units`). `weak: true` is only an early sign that nothing matched well; decide from the passages whether they answer.",
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
      const shown = new Map<number, number>();
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
        shown.set(n, (shown.get(n) ?? 0) + 1);
        results.push({ n, locator: hit.locator, title: ref.title, passage });
      }
      const listed = [...registered];
      const totals = listed.length
        ? await count(
            artistId,
            listed.map(([, ref]) => ({ sourceKind: ref.sourceKind, sourceId: ref.sourceId })),
          )
        : new Map<string, number>();
      return {
        results,
        weak,
        truncated,
        documents: listed.map(([n, ref]) => ({
          n,
          sourceKind: ref.sourceKind,
          sourceId: ref.sourceId,
          revision: ref.revision,
          title: ref.title,
          url: ref.url,
          // A document that left the index since the search still had the units just shown.
          units: totals.get(`${ref.sourceKind}:${ref.sourceId}`) ?? shown.get(n)!,
          shown: shown.get(n)!,
        })),
      };
    },
  });
}

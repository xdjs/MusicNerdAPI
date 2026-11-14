import { tool } from "ai";
import { z } from "zod";
import type { ChatDocumentRef, ChatDocuments } from "@/lib/chat/createChatDocuments";
import { trimToPassage } from "@/lib/chat/trimToPassage";
import { countDocumentUnits } from "@/lib/units/countDocumentUnits";
import { readUnits } from "@/lib/units/readUnits";
import { searchUnits } from "@/lib/units/searchUnits";
import { SHORT_DOCUMENT_CHARS, SHORT_DOCUMENT_UNITS } from "@/lib/units/types";

/** Searches one answer may run; the fifth is refused. */
const MAX_SEARCHES = 4;

/**
 * The chat's `searchPassages` tool: hybrid search over the artist's eligible units, each hit's
 * document numbered for citation (`documents.register`), each passage the whole unit, or for a
 * page longer than `PASSAGE_CHARS` the window holding the most query terms (`trimToPassage`). At most four calls per answer; each returned passage is
 * charged to the answer's shared read budget (`Math.ceil(length / 4)` tokens), and results that no
 * longer fit are dropped, unnumbered, with `truncated: true`. Each listed document carries `units`,
 * how many units it has in the index now (one `countDocumentUnits` query per call), and `shown`, how
 * many of them this call returned, so the model can tell when it saw only part of a document.
 *
 * A short document with several hits is returned whole: the highest-ranked document (by its first
 * hit) with at least two hits here, fewer shown than its `units`, and at most `SHORT_DOCUMENT_UNITS`
 * units is read through `readUnits` (so eligibility and currency hold as for the `readUnits` tool),
 * and its units not already shown are appended after the ranked results, in document order, when
 * they total at most `SHORT_DOCUMENT_CHARS` characters and fit the read budget; otherwise nothing is
 * added. At most one document per call; `expanded` names it, and its `shown` equals its `units`.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @param opts.names - The artist's names, display name first.
 * @param opts.signal - Aborts the search.
 * @param opts.search - Replaces `searchUnits` in tests.
 * @param opts.count - Replaces `countDocumentUnits` in tests.
 * @param opts.read - Replaces `readUnits` in tests.
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
    read?: typeof readUnits;
    budget: { remainingTokens: number };
  },
) {
  const search = opts.search ?? searchUnits;
  const count = opts.count ?? countDocumentUnits;
  const read = opts.read ?? readUnits;
  let searches = 0;
  return tool({
    description:
      "Search the artist's saved documents (vault files, their own posts, confirmed research) for passages that answer the question. Always search first. Each result is a whole unit (a page or section; a very long page is cut to its best-matching part) of document n at a locator such as `p.3`; cite it as [n, locator]. Each document lists how many of its units were shown (`shown`) out of its total (`units`). When a short document has several hits, the whole document is included and `expanded` names it. `weak: true` is only an early sign that nothing matched well; decide from the passages whether they answer.",
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
      const unitsOf = (n: number, ref: ChatDocumentRef) =>
        totals.get(`${ref.sourceKind}:${ref.sourceId}`) ?? shown.get(n)!;
      // Listed in order of each document's first hit, so the first that qualifies ranks highest.
      const short = listed.find(([n, ref]) => {
        const units = unitsOf(n, ref);
        return shown.get(n)! >= 2 && shown.get(n)! < units && units <= SHORT_DOCUMENT_UNITS;
      });
      let expanded: number | null = null;
      if (short) {
        const [n, ref] = short;
        const whole = await read(
          artistId,
          { sourceKind: ref.sourceKind, sourceId: ref.sourceId },
          [],
        );
        // A document that changed or went private since it was numbered is not expanded.
        if (whole && whole.revision === ref.revision) {
          const seen = new Set(results.filter(r => r.n === n).map(r => r.locator));
          const rest = whole.units.filter(unit => !seen.has(unit.locator));
          const chars = rest.reduce((sum, unit) => sum + unit.text.length, 0);
          const tokens = rest.reduce((sum, unit) => sum + Math.ceil(unit.text.length / 4), 0);
          if (chars <= SHORT_DOCUMENT_CHARS && tokens <= opts.budget.remainingTokens) {
            opts.budget.remainingTokens -= tokens;
            for (const unit of rest)
              results.push({ n, locator: unit.locator, title: ref.title, passage: unit.text });
            totals.set(`${ref.sourceKind}:${ref.sourceId}`, whole.units.length);
            shown.set(n, whole.units.length);
            expanded = n;
          }
        }
      }
      return {
        results,
        weak,
        truncated,
        expanded,
        documents: listed.map(([n, ref]) => ({
          n,
          sourceKind: ref.sourceKind,
          sourceId: ref.sourceId,
          revision: ref.revision,
          title: ref.title,
          url: ref.url,
          // A document that left the index since the search still had the units just shown.
          units: unitsOf(n, ref),
          shown: shown.get(n)!,
        })),
      };
    },
  });
}

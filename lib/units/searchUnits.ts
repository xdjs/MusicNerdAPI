import { embedQuery } from "@/lib/units/embedQuery";
import { expandSearchQueries } from "@/lib/units/expandSearchQueries";
import { fuseRanks } from "@/lib/units/fuseRanks";
import { getSearchTuning, type SearchTuning } from "@/lib/units/getSearchTuning";
import { searchUnitsByText } from "@/lib/units/searchUnitsByText";
import { searchUnitsByVector } from "@/lib/units/searchUnitsByVector";
import { SEARCH_LIMIT, WEAK_COSINE_DISTANCE, type UnitHit } from "@/lib/units/types";

/**
 * Hybrid search over one artist's eligible units: full-text candidates for each expanded query and
 * vector candidates for one embedding of the raw question, fused by reciprocal rank, at most
 * `MAX_UNITS_PER_DOCUMENT` per source, `SEARCH_LIMIT` in all. The per-source cap, the text mode
 * and the candidate count can be overridden from the environment (`getSearchTuning`).
 *
 * The vector list joins the fusion once per expanded query, as if searched per query; the
 * embedding is the same, so it is fetched once. If embedding fails the search is text-only.
 *
 * `opts.also` adds further questions (the chat's first search also asks the user's own wording,
 * because the model's query can miss a document that the user's words find, measured 2026-11-15).
 * `asked` is `question` then the `also` entries, trimmed, blanks and case-insensitive repeats
 * dropped. Each asked string has its own expanded queries, text lists, one embedding (fetched
 * concurrently with the others) and one vector list; the fused lists are, string by string and
 * query by query, the text list then that string's vector list. A string whose embedding fails
 * contributes text lists only.
 *
 * `weak` is a hint for obviously empty retrievals; it does not detect unanswerable questions
 * (measured 2026-11-14), and the model must decide from the passages. On that day the unanswerable
 * control's best vector score, 0.480, sat inside the range of answerable questions, and in `or`
 * mode the artist's name alone always matches. Because an `or` (or `idf`) match proves little, `weak` reads the strict (`and`)
 * text signal whenever ranking does not use `and` (the default ranking is `idf`): one extra `and` query of one row per expanded query, run
 * alongside the ranking queries. It is not derived from the ranking lists, which cannot tell whether
 * every word matched.
 *
 * @param artistId - The artist.
 * @param question - The user's question.
 * @param opts.names - The artist's names, display name first (see `expandSearchQueries`).
 * @param opts.also - Further questions searched alongside `question`.
 * @param opts.signal - Aborts the embedding call; an aborted search throws instead of degrading.
 * @param opts.deps - Replaces the collaborators (and the environment's tuning) in tests.
 * @returns The hits; `weak`: no hits at all, or no strict text match and no vector closer than
 * `WEAK_COSINE_DISTANCE`; and `signals`: `textMatched`, whether any expanded query of any asked
 * string matched in strict (`and`) terms; `anyTextMatched`, whether any ranking text list (in the
 * tuning's mode) matched; and the best vector score over all asked strings (`1 - cosine distance`,
 * null when no vector hit came back).
 */
export async function searchUnits(
  artistId: string,
  question: string,
  opts: {
    names: string[];
    also?: string[];
    signal?: AbortSignal;
    deps?: {
      byText?: typeof searchUnitsByText;
      byVector?: typeof searchUnitsByVector;
      embed?: typeof embedQuery;
      tuning?: SearchTuning;
    };
  },
): Promise<{
  hits: UnitHit[];
  weak: boolean;
  signals: { textMatched: boolean; anyTextMatched: boolean; bestVectorScore: number | null };
}> {
  const byText = opts.deps?.byText ?? searchUnitsByText;
  const byVector = opts.deps?.byVector ?? searchUnitsByVector;
  const embed = opts.deps?.embed ?? embedQuery;
  const tuning = opts.deps?.tuning ?? getSearchTuning();
  const seen = new Set<string>();
  const asked = [question, ...(opts.also ?? [])]
    .map(text => text.trim())
    .filter((text, i) => {
      const key = text.toLowerCase();
      if ((text === "" && i > 0) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const embeddings = await Promise.all(
    asked.map(async text => {
      try {
        return await embed(text, { signal: opts.signal });
      } catch (error) {
        if (opts.signal?.aborted) throw error;
        // The error name only: messages can echo the question.
        console.warn("searchUnits: query embedding failed, searching text only", {
          error: error instanceof Error ? error.name : typeof error,
        });
        return null;
      }
    }),
  );

  const searched = await Promise.all(
    asked.map(async (text, i) => {
      const queries = expandSearchQueries(text, opts.names);
      const embedding = embeddings[i];
      const [textLists, vectorList, strictLists] = await Promise.all([
        Promise.all(
          queries.map(query => byText(artistId, query, tuning.candidates, tuning.textMode)),
        ),
        embedding ? byVector(artistId, embedding, tuning.candidates) : Promise.resolve([]),
        // The strict signal for `weak`; in `and` mode the ranking lists already are it.
        tuning.textMode === "and"
          ? null
          : Promise.all(queries.map(query => byText(artistId, query, 1, "and"))),
      ]);
      return { queries, embedding, textLists, vectorList, strictLists };
    }),
  );
  const lists = searched.flatMap(({ queries, embedding, textLists, vectorList }) =>
    queries.flatMap((_, i) => (embedding ? [textLists[i], vectorList] : [textLists[i]])),
  );

  const perDocument = new Map<string, number>();
  const hits: UnitHit[] = [];
  for (const hit of fuseRanks(lists)) {
    if (hits.length === SEARCH_LIMIT) break;
    const document = `${hit.sourceKind}\u0000${hit.sourceId}`;
    const count = perDocument.get(document) ?? 0;
    if (count === tuning.maxUnitsPerDocument) continue;
    perDocument.set(document, count + 1);
    hits.push(hit);
  }

  const anyTextMatched = searched.some(({ textLists }) => textLists.some(list => list.length > 0));
  const textMatched = searched.some(({ strictLists, textLists }) =>
    (strictLists ?? textLists).some(list => list.length > 0),
  );
  const vectorScores = searched.flatMap(({ vectorList }) => vectorList.map(hit => hit.score));
  const bestVectorScore = vectorScores.length ? Math.max(...vectorScores) : null;
  const weak =
    hits.length === 0 ||
    (!textMatched && !(bestVectorScore !== null && bestVectorScore >= 1 - WEAK_COSINE_DISTANCE));
  return { hits, weak, signals: { textMatched, anyTextMatched, bestVectorScore } };
}

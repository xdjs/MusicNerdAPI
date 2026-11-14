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
 * @param artistId - The artist.
 * @param question - The user's question.
 * @param opts.names - The artist's names, display name first (see `expandSearchQueries`).
 * @param opts.signal - Aborts the embedding call; an aborted search throws instead of degrading.
 * @param opts.deps - Replaces the collaborators (and the environment's tuning) in tests.
 * @returns The hits; `weak`: no text match anywhere and no vector closer than `WEAK_COSINE_DISTANCE`;
 * and `signals`, the two inputs of `weak`: whether any text list matched, and the best vector score
 * (`1 - cosine distance`, null when no vector hit came back).
 */
export async function searchUnits(
  artistId: string,
  question: string,
  opts: {
    names: string[];
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
  signals: { textMatched: boolean; bestVectorScore: number | null };
}> {
  const byText = opts.deps?.byText ?? searchUnitsByText;
  const byVector = opts.deps?.byVector ?? searchUnitsByVector;
  const embed = opts.deps?.embed ?? embedQuery;
  const tuning = opts.deps?.tuning ?? getSearchTuning();
  const queries = expandSearchQueries(question, opts.names);

  let embedding: number[] | null = null;
  try {
    embedding = await embed(question, { signal: opts.signal });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    // The error name only: messages can echo the question.
    console.warn("searchUnits: query embedding failed, searching text only", {
      error: error instanceof Error ? error.name : typeof error,
    });
  }

  const [textLists, vectorList] = await Promise.all([
    Promise.all(queries.map(query => byText(artistId, query, tuning.candidates, tuning.textMode))),
    embedding ? byVector(artistId, embedding, tuning.candidates) : Promise.resolve([]),
  ]);
  const lists = queries.flatMap((_, i) =>
    embedding ? [textLists[i], vectorList] : [textLists[i]],
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

  const textMatched = textLists.some(list => list.length > 0);
  const bestVectorScore = vectorList.length ? Math.max(...vectorList.map(hit => hit.score)) : null;
  const weak =
    !textMatched && !(bestVectorScore !== null && bestVectorScore >= 1 - WEAK_COSINE_DISTANCE);
  return { hits, weak, signals: { textMatched, bestVectorScore } };
}

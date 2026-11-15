import { embedQuery } from "@/lib/units/embedQuery";
import { expandSearchQueries } from "@/lib/units/expandSearchQueries";
import { searchUnitsByText } from "@/lib/units/searchUnitsByText";
import { searchUnitsByVector } from "@/lib/units/searchUnitsByVector";
import type { UnitHit } from "@/lib/units/types";

/** One candidate list of a search, best first, as `kind:sourceId8:locator` keys. */
export type CandidateList = { name: string; units: string[] };

const keyOf = (hit: Pick<UnitHit, "sourceKind" | "sourceId" | "locator">) =>
  `${hit.sourceKind}:${hit.sourceId.slice(0, 8)}:${hit.locator}`;

/**
 * The candidate lists behind one search, before fusion, for the retrieval suite's labelling mode:
 * the full-text list in `or` and in `idf` ranking for each expanded query, and the vector list.
 * `searchUnits` returns only the fused top eight, which cannot show why a unit was left out; with
 * these lists a fusion rule can be replayed offline against the labels without another run. Keys
 * hold a source kind, the first eight characters of the source id and the locator: no text.
 *
 * @param artistId - The artist.
 * @param question - The question searched.
 * @param names - The artist's names, display name first (see `expandSearchQueries`).
 * @param limit - The length of each list.
 * @param deps - Replaces the collaborators in tests.
 * @returns `or#0`, `idf#0` (and `or#1`, `idf#1` when the question was expanded), then `vector`.
 */
export async function listSearchCandidates(
  artistId: string,
  question: string,
  names: string[],
  limit = 60,
  deps: {
    byText?: typeof searchUnitsByText;
    byVector?: typeof searchUnitsByVector;
    embed?: typeof embedQuery;
  } = {},
): Promise<CandidateList[]> {
  const byText = deps.byText ?? searchUnitsByText;
  const byVector = deps.byVector ?? searchUnitsByVector;
  const embed = deps.embed ?? embedQuery;
  const lists: CandidateList[] = [];
  for (const [i, query] of expandSearchQueries(question, names).entries())
    for (const mode of ["or", "idf"] as const)
      lists.push({
        name: `${mode}#${i}`,
        units: (await byText(artistId, query, limit, mode)).map(keyOf),
      });
  lists.push({
    name: "vector",
    units: (await byVector(artistId, await embed(question), limit)).map(keyOf),
  });
  return lists;
}

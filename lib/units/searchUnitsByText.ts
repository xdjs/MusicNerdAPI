import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import type { SearchTuning } from "@/lib/units/getSearchTuning";
import { SEARCH_CANDIDATES, type UnitHit, type UnitSourceKind } from "@/lib/units/types";

/**
 * Postgres's `english` stopword list (the Snowball list in `tsearch_data/english.stop`). A query
 * made only of these words gives an empty `websearch_to_tsquery('english', …)`, so it is answered
 * with `[]` without a round trip. The list must never hold a word Postgres keeps, or a real query
 * would be dropped; a word missing from it only costs a query that the SQL guard then empties.
 */
const ENGLISH_STOPWORDS = new Set(
  (
    "i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers herself " +
    "it its itself they them their theirs themselves what which who whom this that these those am is are was were be " +
    "been being have has had having do does did doing a an the and but if or because as until while of at by for with " +
    "about against between into through during before after above below to from up down in out on off over under " +
    "again further then once here there when where why how all any both each few more most other some such no nor " +
    "not only own same so than too very s t can will just don should now"
  ).split(" "),
);

/** The most terms an `or` query keeps. */
const MAX_OR_TERMS = 24;

/**
 * Full-text candidates among one artist's eligible units, best `ts_rank_cd` first.
 *
 * @param artistId - The artist.
 * @param query - In `and` mode, web-search syntax (`websearch_to_tsquery('english', …)`): words,
 * "phrases", -exclusions, or; every word must match. In `or` mode, a plain question: a unit matches
 * on any of its distinct non-stopword terms (at most 24).
 * @param limit - The most hits returned.
 * @param mode - `and` (default) or `or`; `or` ranks by `ts_rank_cd(…, 32)`, rank/(rank+1).
 * @returns Hits scored by cover density, ties in source and unit order; `[]` for a blank or stopword-only query.
 */
export async function searchUnitsByText(
  artistId: string,
  query: string,
  limit = SEARCH_CANDIDATES,
  mode: SearchTuning["textMode"] = "and",
): Promise<UnitHit[]> {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter(word => !ENGLISH_STOPWORDS.has(word)))];
  if (terms.length === 0) return [];
  // The OR query is bound as one parameter made only of letter and digit tokens joined by ` | `,
  // so nothing in the question can reach to_tsquery's operator syntax.
  const tsquery =
    mode === "or"
      ? sql`to_tsquery('english', ${terms.slice(0, MAX_OR_TERMS).join(" | ")})`
      : sql`websearch_to_tsquery('english', ${query})`;
  const rank = mode === "or" ? sql`ts_rank_cd(u.search, q, 32)` : sql`ts_rank_cd(u.search, q)`;
  const rows = await db.execute<{
    source_kind: UnitSourceKind;
    source_id: string;
    source_revision: string;
    unit_index: number;
    locator: string;
    title: string | null;
    url: string | null;
    text: string;
    score: number;
  }>(sql`
    select u.source_kind, u.source_id::text as source_id, u.source_revision, u.unit_index, u.locator,
           u.title, u.url, u.text, ${rank}::float8 as score
      from source_units u, ${tsquery} q
     where numnode(q) > 0 and u.search @@ q and ${eligibleUnitsSql(artistId)}
     order by score desc, u.source_kind, u.source_id, u.unit_index
     limit ${limit}`);
  return rows.map(row => ({
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    sourceRevision: row.source_revision,
    unitIndex: row.unit_index,
    locator: row.locator,
    title: row.title,
    url: row.url,
    text: row.text,
    score: Number(row.score),
  }));
}

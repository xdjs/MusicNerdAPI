import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import type { SearchTuning } from "@/lib/units/getSearchTuning";
import {
  ENGLISH_STOPWORDS,
  SEARCH_CANDIDATES,
  type UnitHit,
  type UnitSourceKind,
} from "@/lib/units/types";

/** The most terms an `or` query keeps. */
const MAX_OR_TERMS = 24;

/**
 * Full-text candidates among one artist's eligible units.
 *
 * @param artistId - The artist.
 * @param query - In `and` mode, web-search syntax (`websearch_to_tsquery('english', …)`): words,
 * "phrases", -exclusions, or; every word must match. In `or` and `idf` modes, a plain question: a
 * unit matches on any of its distinct non-stopword terms (at most 24).
 * @param limit - The most hits returned.
 * @param mode - `and` (default) and `or` rank by cover density (`ts_rank_cd`; `or` normalises it,
 * rank/(rank+1)). Postgres ranking has no notion of how rare a term is, so in `or` mode a unit that
 * repeats a common word (the artist's name) outranks the one unit that holds the question's rare
 * words. `idf` ranks by the sum, over the question's terms a unit contains, of each term's rarity
 * among the artist's eligible units (the BM25 inverse document frequency, each term counted once per
 * unit), with cover density breaking ties.
 * @returns Hits, best first, ties in source and unit order; `[]` for a blank or stopword-only query.
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
  type Row = {
    source_kind: UnitSourceKind;
    source_id: string;
    source_revision: string;
    unit_index: number;
    locator: string;
    title: string | null;
    url: string | null;
    text: string;
    score: number;
  };
  const kept = terms.slice(0, MAX_OR_TERMS);
  const rows =
    mode === "idf"
      ? // Terms are letter and digit tokens only, bound as one space-joined parameter. One
        // artist's eligible units are a few hundred rows, so they are materialised once.
        await db.execute<Row>(sql`
    with eligible as materialized (
      select u.source_kind, u.source_id, u.source_revision, u.unit_index, u.locator, u.title, u.url,
             u.text, u.search
        from source_units u
       where ${eligibleUnitsSql(artistId)}
    ),
    terms as (
      select t.term, to_tsquery('english', t.term) as q
        from unnest(string_to_array(${kept.join(" ")}, ' ')) as t(term)
    ),
    weighted as (
      select t.q,
             ln(1 + ((select count(*) from eligible) - count(*) + 0.5) / (count(*) + 0.5)) as weight
        from terms t
        join eligible x on numnode(t.q) > 0 and x.search @@ t.q
       group by t.term, t.q
    ),
    anyterm as (select to_tsquery('english', ${kept.join(" | ")}) as q)
    select x.source_kind, x.source_id::text as source_id, x.source_revision, x.unit_index, x.locator,
           x.title, x.url, x.text, sum(w.weight)::float8 as score
      from eligible x
      join weighted w on x.search @@ w.q
      cross join anyterm a
     group by x.source_kind, x.source_id, x.source_revision, x.unit_index, x.locator, x.title, x.url,
              x.text, x.search, a.q
     order by score desc, ts_rank_cd(x.search, a.q, 32) desc, x.source_kind, x.source_id, x.unit_index
     limit ${limit}`)
      : await db.execute<Row>(sql`
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

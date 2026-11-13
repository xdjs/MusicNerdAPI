import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import { SEARCH_CANDIDATES, type UnitHit, type UnitSourceKind } from "@/lib/units/types";

/**
 * Nearest eligible units of one artist to a query embedding by cosine distance (pgvector `<=>`).
 *
 * @param artistId - The artist.
 * @param embedding - The query vector, `EMBEDDING_DIMENSIONS` long.
 * @param limit - The most hits returned.
 * @returns Hits closest first, scored `1 - cosine distance`; units without an embedding never appear.
 *
 * When the planner orders by the HNSW index, pgvector scans the index first and filters afterwards,
 * so a small artist among many others can come back with fewer rows than exist (verified against
 * real Postgres: zero rows for three eligible units). The search therefore runs in a transaction
 * that sets, locally, `hnsw.iterative_scan = 'strict_order'` (pgvector 0.8+: keep scanning until
 * enough rows pass the filter, still in exact distance order; skipped on older servers) and
 * `hnsw.ef_search = 100` (a wider candidate list on every version).
 */
export async function searchUnitsByVector(
  artistId: string,
  embedding: number[],
  limit = SEARCH_CANDIDATES,
): Promise<UnitHit[]> {
  const distance = sql`u.embedding operator(extensions.<=>) ${JSON.stringify(embedding)}::extensions.vector`;
  const rows = await db.transaction(async tx => {
    await tx.execute(sql`select set_config('hnsw.ef_search', '100', true)`);
    // The setting does not exist before pgvector 0.8; the failed set is rolled back to the block's start.
    await tx.execute(
      sql`do $$ begin perform set_config('hnsw.iterative_scan', 'strict_order', true); exception when others then null; end $$`,
    );
    return tx.execute<{
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
           u.title, u.url, u.text, (1 - (${distance}))::float8 as score
      from source_units u
     where u.embedding is not null and ${eligibleUnitsSql(artistId)}
     order by ${distance}
     limit ${limit}`);
  });
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

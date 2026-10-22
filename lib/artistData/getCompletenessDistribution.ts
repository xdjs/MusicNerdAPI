import { sql } from "drizzle-orm";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import type { CompletenessBucket } from "@/lib/artistData/types";
import { db } from "@/lib/db/db";

/**
 * How many tracked columns each artist has filled, bucketed, with the median
 * and average across all artists.
 *
 * @returns The buckets in order, and the median and average field counts.
 */
export async function getCompletenessDistribution(): Promise<{
  buckets: CompletenessBucket[];
  medianFields: number;
  averageFields: number;
}> {
  // Build the SUM of CASE expressions for field_count
  const caseExpressions = TRACKED_COLUMNS.map(
    ({ column }) =>
      sql`CASE WHEN ${sql.identifier(column)} IS NOT NULL AND ${sql.identifier(column)} != '' THEN 1 ELSE 0 END`,
  );
  const fieldCountExpr = sql.join(caseExpressions, sql` + `);

  const rows = await db.execute<{
    bucket: string;
    count: number;
    sort_order: number;
    median_fields: string;
    avg_fields: string;
  }>(sql`
    WITH field_counts AS (
      SELECT (${fieldCountExpr}) AS field_count
      FROM artists
    ),
    stats AS (
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY field_count)::numeric(5,1) AS median_fields,
        AVG(field_count)::numeric(5,1) AS avg_fields
      FROM field_counts
    )
    SELECT
      CASE
        WHEN fc.field_count <= 1 THEN '0-1'
        WHEN fc.field_count <= 3 THEN '2-3'
        WHEN fc.field_count <= 6 THEN '4-6'
        WHEN fc.field_count <= 10 THEN '7-10'
        ELSE '11+'
      END AS bucket,
      CASE
        WHEN fc.field_count <= 1 THEN 1
        WHEN fc.field_count <= 3 THEN 2
        WHEN fc.field_count <= 6 THEN 3
        WHEN fc.field_count <= 10 THEN 4
        ELSE 5
      END AS sort_order,
      COUNT(*)::int AS count,
      s.median_fields,
      s.avg_fields
    FROM field_counts fc, stats s
    GROUP BY bucket, sort_order, s.median_fields, s.avg_fields
    ORDER BY sort_order
  `);

  const allRows = [...rows];
  const totalArtists = allRows.reduce((sum, r) => sum + r.count, 0);
  // median_fields and avg_fields are identical across all rows because the
  // `stats` CTE is cross-joined — safe to read from any row.
  const medianFields = parseFloat(allRows[0]?.median_fields ?? "0");
  const averageFields = parseFloat(allRows[0]?.avg_fields ?? "0");

  const buckets: CompletenessBucket[] = allRows.map(r => ({
    bucket: r.bucket,
    count: r.count,
    percentage: totalArtists > 0 ? Math.round((r.count / totalArtists) * 10000) / 100 : 0,
  }));

  return { buckets, medianFields, averageFields };
}

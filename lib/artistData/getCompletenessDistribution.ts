import { sql } from "drizzle-orm";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import type { CompletenessBucket } from "@/lib/artistData/types";
import { db } from "@/lib/db/db";

/**
 * How many tracked columns artists have filled, bucketed, with the median and mean.
 *
 * @returns The buckets in order and the median and average field counts.
 */
export async function getCompletenessDistribution(): Promise<{
  buckets: CompletenessBucket[];
  medianFields: number;
  averageFields: number;
}> {
  const fieldCount = sql.join(
    TRACKED_COLUMNS.map(
      ({ column }) =>
        sql`case when ${sql.identifier(column)} is not null and ${sql.identifier(column)} != '' then 1 else 0 end`,
    ),
    sql` + `,
  );
  const rows = await db.execute<{
    bucket: string;
    count: number;
    sort_order: number;
    median_fields: string;
    avg_fields: string;
  }>(sql`
    with field_counts as (select (${fieldCount}) as field_count from artists),
    stats as (
      select percentile_cont(0.5) within group (order by field_count)::numeric(5,1) as median_fields,
        avg(field_count)::numeric(5,1) as avg_fields
      from field_counts
    )
    select
      case when fc.field_count <= 1 then '0-1' when fc.field_count <= 3 then '2-3'
        when fc.field_count <= 6 then '4-6' when fc.field_count <= 10 then '7-10' else '11+' end as bucket,
      case when fc.field_count <= 1 then 1 when fc.field_count <= 3 then 2
        when fc.field_count <= 6 then 3 when fc.field_count <= 10 then 4 else 5 end as sort_order,
      count(*)::int as count, s.median_fields, s.avg_fields
    from field_counts fc, stats s
    group by bucket, sort_order, s.median_fields, s.avg_fields
    order by sort_order`);
  const all = [...rows];
  const total = all.reduce((sum, r) => sum + r.count, 0);
  // The stats CTE is cross-joined, so every row carries the same median and mean.
  return {
    buckets: all.map(r => ({
      bucket: r.bucket,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 10000) / 100 : 0,
    })),
    medianFields: parseFloat(all[0]?.median_fields ?? "0"),
    averageFields: parseFloat(all[0]?.avg_fields ?? "0"),
  };
}

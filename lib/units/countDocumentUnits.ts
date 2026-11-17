import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * How many units each of the given documents has in the index right now: units a public read may
 * return (`eligibleUnitsSql`), so units of a private source or cut from an older revision count as
 * none. One query over a bound `values` list of every ref; none for an empty list.
 *
 * @param artistId - The artist.
 * @param refs - The documents.
 * @returns Counts keyed `${sourceKind}:${sourceId}`; a document with no eligible units is absent.
 */
export async function countDocumentUnits(
  artistId: string,
  refs: { sourceKind: UnitSourceKind; sourceId: string }[],
): Promise<Map<string, number>> {
  if (refs.length === 0) return new Map();
  const values = sql.join(
    refs.map(ref => sql`(${ref.sourceKind}::text, ${ref.sourceId}::uuid)`),
    sql`, `,
  );
  const rows = await db.execute<{ source_kind: string; source_id: string; units: number }>(sql`
    select u.source_kind, u.source_id::text as source_id, count(*)::int as units
      from source_units u
      join (select distinct * from (values ${values}) as x(source_kind, source_id)) r
        on r.source_kind = u.source_kind and r.source_id = u.source_id
     where ${eligibleUnitsSql(artistId)}
     group by u.source_kind, u.source_id`);
  return new Map(rows.map(row => [`${row.source_kind}:${row.source_id}`, Number(row.units)]));
}

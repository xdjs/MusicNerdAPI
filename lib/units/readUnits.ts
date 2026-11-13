import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * The units of one source a public read may return, by locator: eligible and current only
 * (`eligibleUnitsSql`), so a source that went private, changed or was deleted reads as nothing.
 *
 * @param artistId - The artist.
 * @param ref - The source.
 * @param locators - The units wanted (`p. 3`, …); unknown ones are skipped.
 * @returns The units in unit order with the revision they were cut from, or null when none qualify.
 */
export async function readUnits(
  artistId: string,
  ref: { sourceKind: UnitSourceKind; sourceId: string },
  locators: string[],
): Promise<{
  revision: string;
  units: { locator: string; text: string; tokens: number }[];
} | null> {
  const wanted = [...new Set(locators)];
  if (wanted.length === 0) return null;
  const rows = await db.execute<{
    source_revision: string;
    locator: string;
    text: string;
    tokens: number;
  }>(sql`
    select u.source_revision, u.locator, u.text, u.tokens
      from source_units u
     where u.source_kind = ${ref.sourceKind} and u.source_id = ${ref.sourceId}::uuid
       and u.locator in (${sql.join(
         wanted.map(locator => sql`${locator}`),
         sql`, `,
       )})
       and ${eligibleUnitsSql(artistId)}
     order by u.unit_index`);
  if (rows.length === 0) return null;
  // Eligible units all carry the source's current revision.
  return {
    revision: rows[0].source_revision,
    units: rows.map(row => ({
      locator: row.locator,
      text: row.text,
      tokens: Number(row.tokens),
    })),
  };
}

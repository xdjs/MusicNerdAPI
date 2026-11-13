import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import type { UnitSourceKind } from "@/lib/units/types";

/** The stored form of a locator the model wrote: trimmed, no space after the marker. */
const normaliseLocator = (locator: string) => locator.trim().replace(/^(p\.|§|¶)\s+/u, "$1");

/**
 * Units of one source a public read may return: eligible and current only (`eligibleUnitsSql`),
 * so a source that went private, changed or was deleted reads as nothing.
 *
 * One query reads every eligible unit's locator, and the text only of the units asked for, so a
 * locator the current document lacks is told apart from a document that is gone.
 *
 * @param artistId - The artist.
 * @param ref - The source.
 * @param locators - The units wanted (`p.3`, `§Heading`, `¶2`); empty for every unit. Each is trimmed and
 *   loses any space after its `p.`, `§` or `¶` marker (`p. 3` reads `p.3`), the form ingest stores.
 * @returns The units in unit order, the revision they were cut from, and the requested locators
 *   the document lacks; null when the source has no eligible units at all.
 */
export async function readUnits(
  artistId: string,
  ref: { sourceKind: UnitSourceKind; sourceId: string },
  locators: string[],
): Promise<{
  revision: string;
  units: { locator: string; text: string; tokens: number }[];
  missing: string[];
} | null> {
  const wanted = [...new Set(locators.map(normaliseLocator))];
  const isWanted =
    wanted.length === 0
      ? sql`true`
      : sql`u.locator in (${sql.join(
          wanted.map(locator => sql`${locator}`),
          sql`, `,
        )})`;
  const rows = await db.execute<{
    source_revision: string;
    locator: string;
    text: string | null;
    tokens: number;
  }>(sql`
    select u.source_revision, u.locator, case when ${isWanted} then u.text end as text, u.tokens
      from source_units u
     where u.source_kind = ${ref.sourceKind} and u.source_id = ${ref.sourceId}::uuid
       and ${eligibleUnitsSql(artistId)}
     order by u.unit_index`);
  if (rows.length === 0) return null;
  const found = new Set(rows.map(row => row.locator));
  // Eligible units all carry the source's current revision.
  return {
    revision: rows[0].source_revision,
    units: rows.flatMap(row =>
      row.text === null
        ? []
        : [{ locator: row.locator, text: row.text, tokens: Number(row.tokens) }],
    ),
    missing: wanted.filter(locator => !found.has(locator)),
  };
}

import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { UNIT_INGEST_VERSION, type UnitDraft, type UnitSourceKind } from "@/lib/units/types";

const INSERT_BATCH = 100;

const SOURCE_TABLE: Record<UnitSourceKind, string> = {
  vault: "artist_vault_sources",
  social: "artist_social_posts",
  evidence: "artist_research_evidence",
};

/** Replace every unit of one source in the caller's transaction; returns the rows written. */
export async function writeSourceUnits(
  tx: WriteDb,
  input: {
    sourceKind: UnitSourceKind;
    sourceId: string;
    artistId: string;
    sourceRevision: string;
    title: string | null;
    url: string | null;
    units: UnitDraft[];
    embeddings: number[][] | null;
  },
): Promise<number> {
  const { sourceKind, sourceId, artistId, sourceRevision, title, url, units, embeddings } = input;
  if (embeddings && embeddings.length !== units.length) {
    throw new Error(
      `Embedding count mismatch: ${units.length} units but ${embeddings.length} embeddings`,
    );
  }
  // The table name is a code constant, never input. Key share blocks a concurrent delete until we commit.
  const locked = await tx.execute(
    sql`select 1 from ${sql.raw(SOURCE_TABLE[sourceKind])} where id = ${sourceId}::uuid for key share`,
  );
  await tx.execute(
    sql`delete from source_units where source_kind = ${sourceKind} and source_id = ${sourceId}::uuid`,
  );
  if (!locked.length) return 0;
  for (let start = 0; start < units.length; start += INSERT_BATCH) {
    const values = units.slice(start, start + INSERT_BATCH).map((unit, offset) => {
      const embedding = embeddings?.[start + offset];
      // public, not extensions: the app role has no USAGE on the extensions schema.
      const vector = embedding?.length
        ? sql`${JSON.stringify(embedding)}::public.vector`
        : sql`null`;
      return sql`(${sourceKind}, ${sourceId}::uuid, ${artistId}::uuid, ${sourceRevision}, ${unit.unitIndex}, ${unit.locator}, ${title}, ${url}, ${unit.text}, ${unit.textHash}, ${unit.tokens}, ${unit.ocr}, ${UNIT_INGEST_VERSION}, ${vector})`;
    });
    await tx.execute(sql`insert into source_units
      (source_kind, source_id, artist_id, source_revision, unit_index, locator, title, url, text, text_hash, tokens, ocr, ingest_version, embedding)
      values ${sql.join(values, sql`, `)}`);
  }
  return units.length;
}

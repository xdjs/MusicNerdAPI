import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { buildSourceUnits } from "@/lib/units/buildSourceUnits";
import { embedUnits } from "@/lib/units/embedUnits";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import { loadUnitSource } from "@/lib/units/loadUnitSource";
import { writeSourceUnits } from "@/lib/units/writeSourceUnits";
import type { IngestOutcome, UnitSourceKind } from "@/lib/units/types";
import { PDF_PARSE_TIMEOUT_MS } from "@/lib/vaultUpload/const";

/**
 * Ingest one source into the page-level text index: load, split into units, embed, and replace the source's rows in one transaction.
 *
 * A vision or embedding failure never throws: vision failures surface as `failed`, an embedding failure writes the units without embeddings (`embedded: false`).
 * A vault row whose `extracted_text` is null gets it filled once from OCR text, in the same transaction.
 * A source with no text clears its stale units. Database errors propagate.
 *
 * @param ref - The source to ingest.
 * @param opts - `bytes` are PDF bytes already in hand; `embed: false` skips embedding; `pdfTimeoutMs` bounds the PDF parse.
 * @returns What was written and why anything was skipped or failed.
 */
export async function ingestSource(
  ref: { sourceKind: UnitSourceKind; sourceId: string },
  opts: {
    bytes?: Uint8Array;
    signal?: AbortSignal;
    embed?: boolean;
    pdfTimeoutMs?: number;
  } = {},
): Promise<IngestOutcome> {
  const input = await loadUnitSource(ref, { bytes: opts.bytes, signal: opts.signal });
  if (!input) return { units: 0, ocrPages: 0, embedded: false, skipped: "not-found" };

  const built = await buildSourceUnits(input, {
    signal: opts.signal,
    pdfTimeoutMs: opts.pdfTimeoutMs ?? PDF_PARSE_TIMEOUT_MS,
  });
  const base = {
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    artistId: input.artistId,
    sourceRevision: input.sourceRevision,
    title: input.title,
    url: input.url,
  };
  const failed = built.failed ? { failed: built.failed } : {};

  if (input.body.kind === "none" || built.units.length === 0) {
    // Nothing to index: remove whatever an earlier ingest left for this source.
    await db.transaction(tx => writeSourceUnits(tx, { ...base, units: [], embeddings: null }));
    return { units: 0, ocrPages: 0, embedded: false, skipped: "no-text", ...failed };
  }

  let embeddings: number[][] | null = null;
  if (opts.embed !== false) {
    try {
      embeddings = await embedUnits(
        built.units.map(u => u.text),
        { signal: opts.signal },
      );
    } catch (error) {
      console.warn(
        `Embedding failed for ${input.sourceKind} source ${input.sourceId}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  // Fill only from a complete read, so a partial one leaves the blob null for a later complete read.
  const fillExtractedText =
    input.sourceKind === "vault" &&
    input.extractedTextIsNull &&
    !built.failed &&
    built.units.some(u => u.ocr);
  const written = await db.transaction(async tx => {
    let sourceRevision = base.sourceRevision;
    if (fillExtractedText) {
      // The one allowed write to this column; the null guard keeps it idempotent. The fill changes the
      // vault revision, so the units are stamped with the revision it returns, or they would be stale on commit.
      const joined = built.units.map(u => u.text).join("\n\n");
      const rows = await tx.execute<{ revision: string }>(
        sql`update artist_vault_sources v set extracted_text = ${joined} where v.id = ${input.sourceId}::uuid and v.extracted_text is null returning ${vaultSourceRevisionSql()} as revision`,
      );
      if (rows[0]) sourceRevision = rows[0].revision;
    }
    return writeSourceUnits(tx, { ...base, sourceRevision, units: built.units, embeddings });
  });

  return { units: written, ocrPages: built.ocrPages, embedded: embeddings !== null, ...failed };
}

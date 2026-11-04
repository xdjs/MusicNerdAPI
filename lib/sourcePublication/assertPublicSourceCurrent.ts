import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { normalizeKnowledgeSourceSnapshot } from "@/lib/knowledge/normalizeKnowledgeSourceSnapshot";
import { readResearchEvidence } from "@/lib/questionResearch/readResearchEvidence";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import { publicVaultSourceSql } from "./publicVaultSourceSql";

/** Revalidate claim/publication and revision before a saved vault original is reused. */
export async function assertPublicSourceCurrent(artistId: string, source: ResearchOriginal) {
  if (source.sourceId.startsWith("vault:")) {
    const [row] = await db.execute<{ snapshot: unknown }>(sql`
      select public.knowledge_vault_source_snapshot(v) || jsonb_build_object('publication',v.publication) as snapshot from artist_vault_sources v
      where v.artist_id=${artistId}::uuid and v.id=${source.sourceId.slice(6)}::uuid
        and v.file_path is null and ${publicVaultSourceSql()}`);
    const current =
      row &&
      normalizeKnowledgeSourceSnapshot(row.snapshot, artistId).find(
        s => s.metadata.sourceId === source.sourceId,
      );
    if (!current || current.metadata.revision !== source.revision)
      throw new Error("Source changed or is no longer public");
  } else if (source.sourceId.startsWith("discovery:")) {
    await readResearchEvidence(
      artistId,
      { kind: "service" },
      source.sourceId.slice(10),
      source.revision,
      0,
      1,
    );
  }
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { normalizeKnowledgeSourceSnapshot } from "@/lib/knowledge/normalizeKnowledgeSourceSnapshot";
import { readKnowledgePassage } from "@/lib/knowledge/readKnowledgePassage";
import { MAX_KNOWLEDGE_CHARS, MAX_RETAINED_SOURCE_VERSIONS } from "@/lib/knowledge/types";
import type { KnowledgeQuery } from "@/lib/knowledge/types";

/** Reopens one authorized source revision without loading other evidence or writing on a read. */
export async function readArtistKnowledge(
  artistId: string,
  userId: string,
  query: Extract<KnowledgeQuery, { operation: "read" }>,
) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const vault = query.sourceId.startsWith("vault:");
      const sourceId = query.sourceId.split(":")[1];
      const parent = sql.identifier(vault ? "artist_vault_sources" : "artist_social_posts");
      const archive = sql.identifier(
        vault ? "artist_vault_source_versions" : "artist_social_post_versions",
      );
      const snapshotFunction = sql.identifier(
        vault ? "knowledge_vault_source_snapshot" : "knowledge_social_post_snapshot",
      );
      const [row] = await tx.execute<{ snapshot: unknown; chars: number }>(sql`
      with candidate as materialized (
        select public.${snapshotFunction}(s) as snapshot from public.${parent} s
        where id=${sourceId}::uuid and artist_id=${artistId}::uuid
      ) select case when char_length(snapshot::text)<=${MAX_KNOWLEDGE_CHARS} then snapshot else null end as snapshot,
        char_length(snapshot::text) as chars from candidate
    `);
      if (!row) throw new KnowledgeError("not_found", 404, "Source unavailable for this artist");
      if (Number(row.chars) > MAX_KNOWLEDGE_CHARS)
        throw new KnowledgeError(
          "corpus_too_large",
          413,
          "Source exceeds the supported snapshot size",
        );
      const current = normalizeKnowledgeSourceSnapshot(row.snapshot, artistId).find(
        s => s.metadata.sourceId === query.sourceId,
      );
      if (!current)
        throw new KnowledgeError("not_found", 404, "Source unavailable for this artist");
      if (current.metadata.revision === query.revision) return readKnowledgePassage(current, query);
      if (!query.includeVersion)
        throw new KnowledgeError(
          "revision_changed",
          409,
          "Source revision changed; reload its metadata",
        );

      const [size] = await tx.execute<{ rows: number; chars: number }>(sql`
      select count(*)::int as rows, coalesce(sum(char_length(snapshot::text)),0)::bigint as chars
      from public.${archive} where source_id=${sourceId}::uuid and artist_id=${artistId}::uuid
    `);
      if (!size) throw new Error("Source version size unavailable");
      if (
        Number(size.rows) > MAX_RETAINED_SOURCE_VERSIONS ||
        Number(size.chars) > MAX_KNOWLEDGE_CHARS
      )
        throw new KnowledgeError(
          "revision_history_too_large",
          413,
          "Retained source history exceeds the supported lookup size",
        );
      const versions = await tx.execute<{ snapshot: unknown; capturedAt: string }>(sql`
      select snapshot, to_char(captured_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "capturedAt"
      from public.${archive} where source_id=${sourceId}::uuid and artist_id=${artistId}::uuid
      order by captured_at desc, fingerprint limit ${MAX_RETAINED_SOURCE_VERSIONS}
    `);
      if (JSON.stringify(versions).length > MAX_KNOWLEDGE_CHARS)
        throw new KnowledgeError(
          "revision_history_too_large",
          413,
          "Retained source history exceeds the supported lookup size",
        );
      for (const saved of versions) {
        const original = normalizeKnowledgeSourceSnapshot(saved.snapshot, artistId).find(
          s => s.metadata.sourceId === query.sourceId && s.metadata.revision === query.revision,
        );
        if (original)
          return readKnowledgePassage(original, query, {
            state: "historical",
            currentRevision: current.metadata.revision,
            capturedAt: new Date(saved.capturedAt).toISOString(),
          });
      }
      throw new KnowledgeError(
        "revision_changed",
        409,
        "Requested source revision was not retained; reload its metadata",
      );
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

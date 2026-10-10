import { getStoredLatestProviders } from "@/lib/latestProviders/getStoredLatestProviders";
import { sql } from "drizzle-orm";
import { loadPublicLatestOriginals } from "@/lib/questionResearch/loadPublicLatestOriginals";
import { db } from "@/lib/db/db";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { normalizeKnowledgeSourceSnapshot } from "@/lib/knowledge/normalizeKnowledgeSourceSnapshot";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";
import type { ResearchOriginal, DiscoveryOriginal } from "@/lib/questionResearch/types";

/** Read bounded public originals only; uploads, unpublished answers, corrections and private review rows never enter this corpus. */
export async function loadPublicResearchOriginals(artistId: string): Promise<ResearchOriginal[]> {
  return db.transaction(
    async tx => {
      const scope = sql`
      select public.knowledge_vault_source_snapshot(v) as snapshot from artist_vault_sources v
      where artist_id=${artistId}::uuid and status='approved' and file_path is null
      union all select public.knowledge_social_post_snapshot(s) from artist_social_posts s
      where artist_id=${artistId}::uuid and is_own_post=true
        and raw->'isRepost' is distinct from 'true'::jsonb and raw->'isRetweet' is distinct from 'true'::jsonb`;
      const [size] = await tx.execute<{ n: number; chars: number }>(
        sql`with originals as (${scope}) select count(*)::int as n, coalesce(sum(char_length(snapshot::text)),0)::bigint as chars from originals`,
      );
      const [discoverySize] = await tx.execute<{ n: number; chars: number }>(
        sql`select count(*)::int as n,coalesce(sum(char_length(e.original_text)),0)::bigint as chars from artist_research_evidence e join artist_research_candidates c on c.id=e.candidate_id and c.artist_id=e.artist_id where e.revision=c.current_revision and c.artist_id=${artistId}::uuid and c.identity='confirmed' and c.curation in ('pending','approved') and (c.reviewed_revision is null or (c.destination='lore' and exists(select 1 from artist_vault_sources v where v.id=c.source_id and v.artist_id=c.artist_id and v.status='approved' and v.file_path is null)) or (c.destination='link' and exists(select 1 from artists a where a.id=c.artist_id and to_jsonb(a)->>c.platform=c.platform_id)))`,
      );
      if (!size || !discoverySize) throw new Error("Research corpus unavailable");
      if (
        Number(size.n) + Number(discoverySize.n) > MAX_KNOWLEDGE_ROWS ||
        Number(size.chars) + Number(discoverySize.chars) > MAX_KNOWLEDGE_CHARS
      )
        throw new KnowledgeError(
          "corpus_too_large",
          413,
          "Public evidence exceeds the supported snapshot size",
        );
      const rows = await tx.execute<{ snapshot: unknown }>(scope);
      const sources: ResearchOriginal[] = rows
        .flatMap(row => normalizeKnowledgeSourceSnapshot(row.snapshot, artistId))
        .filter(s => s.text.trim() && s.metadata.url?.startsWith("http"))
        .map(s => ({
          sourceId: s.metadata.sourceId,
          revision: s.metadata.revision,
          text: s.text,
          url: s.metadata.url!,
          curation: "approved",
          evidenceKind:
            s.metadata.kind === "social_caption"
              ? "caption"
              : s.metadata.kind === "reel_transcript"
                ? "provider_transcript"
                : "original_text",
          speaker:
            s.metadata.provenance.speaker === "not_applicable" ? "not_applicable" : "unverified",
          publishedAt: s.metadata.publishedAt,
          retrievedAt: s.metadata.ingestedAt,
          truncated: s.metadata.extraction.truncated,
        }));
      const discoveries = await tx.execute<{
        id: string;
        revision: string;
        original_text: string;
        url: string;
        curation: "approved" | "pending";
        provenance: DiscoveryOriginal["provenance"];
      }>(
        sql`select distinct on (c.id) e.id,e.revision,e.original_text,c.url,case when c.curation='approved' and c.reviewed_revision=e.revision then 'approved' else 'pending' end as curation,e.provenance from artist_research_evidence e join artist_research_candidates c on c.id=e.candidate_id and c.artist_id=e.artist_id where e.revision=c.current_revision and c.artist_id=${artistId}::uuid and c.identity='confirmed' and c.curation in ('pending','approved') and (c.reviewed_revision is null or (c.destination='lore' and exists(select 1 from artist_vault_sources v where v.id=c.source_id and v.artist_id=c.artist_id and v.status='approved' and v.file_path is null)) or (c.destination='link' and exists(select 1 from artists a where a.id=c.artist_id and to_jsonb(a)->>c.platform=c.platform_id))) order by c.id,e.retrieved_at desc,e.id desc`,
      );
      for (const d of discoveries)
        sources.push({
          sourceId: `discovery:${d.id}`,
          revision: d.revision,
          text: d.original_text,
          url: d.url,
          curation: d.curation,
          evidenceKind: d.provenance.kind,
          speaker: d.provenance.speaker,
          publishedAt: d.provenance.publishedAt,
          retrievedAt: d.provenance.retrievedAt,
          truncated: d.provenance.truncated,
        });
      const latest = [
        ...(await loadPublicLatestOriginals(tx, artistId)),
        ...(await getStoredLatestProviders(artistId, tx)).originals,
      ];
      if (
        sources.length + latest.length > MAX_KNOWLEDGE_ROWS ||
        sources.reduce((total, source) => total + source.text.length, 0) +
          latest.reduce((total, source) => total + source.text.length, 0) >
          MAX_KNOWLEDGE_CHARS
      )
        throw new KnowledgeError(
          "corpus_too_large",
          413,
          "Public evidence exceeds the supported snapshot size",
        );
      return [...sources, ...latest];
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

import { sql } from "drizzle-orm";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { canonicalResearchUrl } from "@/lib/questionResearch/canonicalResearchUrl";
import type { TransactionDb } from "@/lib/ownership/types";
import type {
  DiscoveryOriginal,
  QuestionResearchState,
  ResearchReference,
} from "@/lib/questionResearch/types";

/** Append exact selected originals inside the worker's lease/artist transaction; never adopt profiles. */
export async function persistResearchOriginals(
  tx: TransactionDb,
  artistId: string,
  state: QuestionResearchState,
  originals: DiscoveryOriginal[],
): Promise<ResearchReference[]> {
  if (originals.length > 3) throw new Error("Research original budget exceeded");
  const existing = await tx.execute<{
    id: string;
    url: string;
    curation: string;
    identity: string;
    reviewed_revision: string | null;
    source_id: string | null;
  }>(
    sql`select id,url,curation,identity,reviewed_revision,source_id from artist_research_candidates where artist_id=${artistId}::uuid limit 5001`,
  );
  const vault = await tx.execute<{ id: string; url: string; status: string }>(
    sql`select id,url,status from artist_vault_sources where artist_id=${artistId}::uuid limit 5001`,
  );
  if (existing.length > 5000 || vault.length > 5000)
    throw new KnowledgeError(
      "corpus_too_large",
      413,
      "Discovery review corpus exceeds its supported bound",
    );
  const key = (url: string) => {
    try {
      return canonicalResearchUrl(url);
    } catch {
      return url;
    }
  };
  const references: ResearchReference[] = [];
  for (const original of originals) {
    if (!original.text.trim() || original.text.length > 50000) continue;
    const url = canonicalResearchUrl(original.url);
    // All existing vault choices remain authoritative, including an artist's prior rejection.
    let candidate = existing.find(c => key(c.url) === url);
    if (
      vault.some(
        v => key(v.url) === url && (v.id !== candidate?.source_id || v.status !== "approved"),
      )
    )
      continue;
    if (candidate && !["pending", "approved"].includes(candidate.curation)) continue;
    if (!candidate) {
      [candidate] = await tx.execute<{
        id: string;
        url: string;
        curation: string;
        identity: string;
        reviewed_revision: string | null;
        source_id: string | null;
      }>(
        sql`insert into artist_research_candidates(artist_id,url,destination,platform,platform_id,reason,identity) values(${artistId}::uuid,${url},${original.destination},${original.platform ?? null},${original.platformId ?? null},${state.request.evidenceNeed},${original.identity}) returning id,url,curation,identity,reviewed_revision,source_id`,
      );
      if (!candidate) throw new Error("Discovery was not persisted");
      existing.push(candidate);
    } else if (candidate.identity === "unresolved" && original.identity === "confirmed") {
      await tx.execute(
        sql`update artist_research_candidates set identity='confirmed',updated_at=now() where id=${candidate.id}::uuid`,
      );
      candidate.identity = "confirmed";
    }
    // Retrieval timestamp/run identity are provenance, not a new original revision.
    const { retrievedAt, runId, ...stableProvenance } = original.provenance;
    void runId;
    const revision = knowledgeRevision({
      url,
      title: original.title,
      text: original.text,
      provenance: stableProvenance,
    });
    if (candidate.curation === "approved" && candidate.reviewed_revision !== revision) {
      await tx.execute(
        sql`update artist_research_candidates set curation='pending',updated_at=now() where id=${candidate.id}::uuid`,
      );
      candidate.curation = "pending";
    }
    const [evidence] = await tx.execute<{
      id: string;
      provenance: DiscoveryOriginal["provenance"];
    }>(
      sql`insert into artist_research_evidence(candidate_id,artist_id,revision,title,original_text,provenance) values(${candidate.id}::uuid,${artistId}::uuid,${revision},${original.title?.slice(0, 500) ?? null},${original.text},${JSON.stringify(original.provenance)}::jsonb) on conflict(candidate_id,revision) do nothing returning id,provenance`,
    );
    const saved =
      evidence ??
      (
        await tx.execute<{ id: string; provenance: DiscoveryOriginal["provenance"] }>(
          sql`select id,provenance from artist_research_evidence where candidate_id=${candidate.id}::uuid and artist_id=${artistId}::uuid and revision=${revision}`,
        )
      )[0];
    if (!saved) throw new Error("Original evidence was not retained");
    await tx.execute(
      sql`update artist_research_candidates set current_revision=${revision},updated_at=now() where id=${candidate.id}::uuid`,
    );
    if (candidate.identity === "confirmed")
      references.push({
        sourceId: `discovery:${saved.id}`,
        revision,
        text: original.text,
        start: 0,
        end: original.text.length,
        url,
        curation: candidate.curation as "approved" | "pending",
        evidenceKind: original.provenance.kind,
        speaker: original.provenance.speaker,
        publishedAt: original.provenance.publishedAt,
        retrievedAt: saved.provenance.retrievedAt ?? retrievedAt,
        truncated: original.provenance.truncated,
      });
  }
  return references;
}

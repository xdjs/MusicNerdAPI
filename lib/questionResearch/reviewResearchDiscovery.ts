import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";
import { toResearchCandidate } from "@/lib/questionResearch/toResearchCandidate";
import type { ResearchCandidateRow, ResearchEvidenceRow } from "@/lib/questionResearch/types";

/** Atomically review the exact current original and promote only through current artist authority. */
export async function reviewResearchDiscovery(
  artistId: string,
  userId: string,
  candidateId: string,
  revision: string,
  decision: "approve" | "decline" | "wrong_artist" | "incorrect",
) {
  // Read only the lock keys first. Re-read the candidate after all required locks.
  const [hint] = await db.execute<ResearchCandidateRow>(
    sql`select * from artist_research_candidates where id=${candidateId}::uuid and artist_id=${artistId}::uuid`,
  );
  if (!hint) throw new KnowledgeError("not_found", 404, "Discovery unavailable");
  return db.transaction(async tx => {
    if (
      decision === "approve" &&
      hint.destination === "link" &&
      hint.platform &&
      hint.platform_id
    ) {
      assertWritableLinkColumn(hint.platform);
      await acquireArtistPlatformWriteLocks(tx, artistId, hint.platform, hint.platform_id);
    }
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [candidate] = await tx.execute<ResearchCandidateRow>(
      sql`select * from artist_research_candidates where id=${candidateId}::uuid and artist_id=${artistId}::uuid for update`,
    );
    if (!candidate) throw new KnowledgeError("not_found", 404, "Discovery unavailable");
    if (
      candidate.platform !== hint.platform ||
      candidate.platform_id !== hint.platform_id ||
      candidate.destination !== hint.destination
    )
      throw new KnowledgeError("review_changed", 409, "Discovery changed; reload before reviewing");
    const [evidence] = await tx.execute<ResearchEvidenceRow>(
      sql`select id,revision,title,original_text,provenance from artist_research_evidence where candidate_id=${candidateId}::uuid and artist_id=${artistId}::uuid and revision=${candidate.current_revision} limit 1`,
    );
    if (!evidence || evidence.revision !== revision)
      throw new KnowledgeError(
        "revision_changed",
        409,
        "Original changed; read the current revision before reviewing",
      );
    if (
      candidate.curation === "approved" &&
      decision === "approve" &&
      candidate.reviewed_revision === revision
    )
      return { status: "ok" as const, candidate: toResearchCandidate(candidate, evidence) };
    if (candidate.curation !== "pending")
      throw new KnowledgeError("review_changed", 409, "This discovery was already reviewed");
    let sourceId = candidate.source_id;
    if (decision === "approve" && candidate.destination === "link") {
      if (!candidate.platform || !candidate.platform_id)
        throw new KnowledgeError("invalid_discovery", 409, "Profile target unavailable");
      assertWritableLinkColumn(candidate.platform);
      const [artist] = await tx.execute<{ value: string | null }>(
        sql`select ${sql.identifier(candidate.platform)} as value from artists where id=${artistId}::uuid`,
      );
      if (artist?.value && artist.value !== candidate.platform_id)
        throw new KnowledgeError(
          "link_conflict",
          409,
          "A different account is already connected; review it before replacing it",
        );
      await writeArtistLinkColumn(tx, artistId, candidate.platform, candidate.platform_id);
    }
    if (decision === "approve" && candidate.destination === "lore") {
      const existing = await tx.execute<{ id: string; status: string }>(
        sql`select id,status from artist_vault_sources where artist_id=${artistId}::uuid and url=${candidate.url} for update`,
      );
      if (existing.length && existing[0].id !== sourceId)
        throw new KnowledgeError(
          "source_conflict",
          409,
          "This URL already has a Lore review; use that existing item",
        );
      const type =
        evidence.provenance.kind === "caption"
          ? "social_caption"
          : evidence.provenance.kind === "provider_transcript"
            ? "reel_transcript"
            : "article";
      const publication = evidence.provenance.publishedAt;
      const publishedAt =
        publication &&
        /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(publication) &&
        Number.isFinite(Date.parse(publication))
          ? publication.slice(0, 10)
          : null;
      if (sourceId) {
        const changed = await tx.execute(
          sql`update artist_vault_sources set title=${evidence.title},extracted_text=${evidence.original_text},type=${type},published_at=${publishedAt}::date,status='approved',updated_at=now() where id=${sourceId}::uuid and artist_id=${artistId}::uuid returning id`,
        );
        if (!changed.length)
          throw new KnowledgeError(
            "source_changed",
            409,
            "The previous Lore source was removed; reload review",
          );
      } else {
        const [source] = await tx.execute<{ id: string }>(
          sql`insert into artist_vault_sources(artist_id,origin,url,title,type,status,extracted_text,published_at) values(${artistId}::uuid,'question_research',${candidate.url},${evidence.title},${type},'approved',${evidence.original_text},${publishedAt}::date) returning id`,
        );
        if (!source) throw new Error("Approved source unavailable");
        sourceId = source.id;
      }
    }
    const activityId = await recordArtistActivity(
      artistId,
      `research_discovery_${decision}`,
      { userId, trigger: "discovery_review", ...(sourceId ? { sourceId } : {}) },
      tx,
    );
    if (decision === "approve" && sourceId)
      await tx.execute(
        sql`update artist_vault_sources set activity_id=${activityId}::uuid where id=${sourceId}::uuid and artist_id=${artistId}::uuid`,
      );
    if (sourceId && ["wrong_artist", "incorrect"].includes(decision))
      await tx.execute(
        sql`update artist_vault_sources set status='rejected',updated_at=now() where id=${sourceId}::uuid and artist_id=${artistId}::uuid`,
      );
    const curation =
      decision === "approve" ? "approved" : decision === "decline" ? "declined" : decision;
    const [updated] = await tx.execute<ResearchCandidateRow>(
      sql`update artist_research_candidates set curation=${curation},identity=${decision === "wrong_artist" ? "wrong_artist" : decision === "approve" ? "confirmed" : candidate.identity},source_id=${sourceId}::uuid,reviewed_by=${userId}::uuid,review_activity_id=${activityId}::uuid,reviewed_revision=${revision},updated_at=now() where id=${candidateId}::uuid returning *`,
    );
    if (!updated) throw new Error("Discovery review was not saved");
    if (sourceId && decision !== "decline") {
      const claim = await findApprovedClaim(tx, artistId);
      const state = JSON.stringify({ claimId: claim?.id ?? null });
      await tx.execute(
        sql`insert into artist_research_jobs(artist_id,kind,state,activity_id) values(${artistId}::uuid,'lore_refresh',${state}::jsonb,${activityId}::uuid) on conflict (artist_id,kind) where status in ('pending','running') do update set state=jsonb_set(${state}::jsonb,'{requestedAt}',to_jsonb(clock_timestamp()::text)),attempts=0,updated_at=now()`,
      );
    }
    return { status: "ok" as const, candidate: toResearchCandidate(updated, evidence) };
  });
}

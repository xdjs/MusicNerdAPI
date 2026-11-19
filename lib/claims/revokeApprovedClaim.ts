import { sql } from "drizzle-orm";
import { markAboutWriter } from "@/lib/bio/markAboutWriter";
import { prepareBioUrlReceipts } from "@/lib/bio/prepareBioUrlReceipts";
import { readBioProvenance } from "@/lib/bio/readBioProvenance";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";
import { writeBioProvenance } from "@/lib/bio/writeBioProvenance";
import { PROFILE_IMAGE_FOLDER } from "@/lib/artistImages/const";
import { claimColumns } from "@/lib/claims/claimColumns";
import {
  classifyRevokedSource,
  type RevokedSource,
  type RevokedSourceActivity,
} from "@/lib/claims/classifyRevokedSource";
import { RevocationReviewRequiredError } from "@/lib/claims/RevocationReviewRequiredError";
import type { ClaimRow } from "@/lib/claims/types";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { VAULT_BUCKET } from "@/lib/storage/const";

/**
 * Revokes an approved claim in one transaction, as MusicNerdWeb does: deletes
 * the claim and what its claimant added (research jobs, social credits and
 * data, corrections, their own and generated Lore sources, interview answers,
 * onboarding steps and the Lore), keeps verified trusted submissions, clears
 * the profile image link when it is a managed upload, unpins the bio and keeps
 * it in history before clearing it. Stored files are never deleted: the audit
 * log records them for a separate cleanup review. A source whose provenance
 * can't be shown stops the whole revocation.
 *
 * @param claimId - The claim.
 * @param adminUserId - The revoking admin, for the audit rows.
 * @returns The deleted claim, or undefined when it isn't (or is no longer) approved; throws RevocationReviewRequiredError when a source needs review.
 */
export async function revokeApprovedClaim(
  claimId: string,
  adminUserId: string,
): Promise<ClaimRow | undefined> {
  return db.transaction(async tx => {
    const [candidate] = rowsOf(
      await tx.execute(sql`select ${claimColumns} from artist_claims where id = ${claimId}::uuid`),
    ) as ClaimRow[];
    if (!candidate || candidate.status !== "approved") return undefined;
    // The upload and source-review lock order: the artist, then its claim and sources.
    await lockArtistRow(tx, candidate.artistId);
    const sources = rowsOf(
      await tx.execute(sql`select id, artist_id as "artistId", activity_id as "activityId",
          origin, file_path as "filePath"
        from artist_vault_sources where artist_id = ${candidate.artistId}::uuid for update`),
    ) as RevokedSource[];
    const events = rowsOf(
      await tx.execute(sql`select id, artist_id as "artistId", source_id as "sourceId",
          actor_user_id as "actorUserId", actor_kind as "actorKind", action, trigger
        from artist_activity_events where artist_id = ${candidate.artistId}::uuid`),
    ) as RevokedSourceActivity[];
    const byId = new Map(events.map(event => [event.id, event]));
    const removable = sources.filter(source => {
      const disposition = classifyRevokedSource(
        source,
        byId.get(source.activityId ?? "") ?? null,
        candidate.userId,
      );
      if (disposition === "review") throw new RevocationReviewRequiredError();
      return disposition === "delete";
    });
    // Only deletes the claim if it is still approved right now.
    const [deleted] = rowsOf(
      await tx.execute(sql`delete from artist_claims
        where id = ${claimId}::uuid and artist_id = ${candidate.artistId}::uuid
        and user_id = ${candidate.userId}::uuid and status = 'approved'
        returning ${claimColumns}`),
    ) as ClaimRow[];
    if (!deleted) return undefined;
    const artistId = deleted.artistId;
    const auditKey = `admin:${adminUserId}`;

    // Only this storage origin's profile uploads are managed. Keep the bytes and record them.
    const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
    if (supabaseUrl) {
      const prefix = `${supabaseUrl}/storage/v1/object/public/${VAULT_BUCKET}/${PROFILE_IMAGE_FOLDER}/${artistId}_`;
      const managed = sql`id = ${artistId}::uuid and starts_with(custom_image, ${prefix})`;
      await tx.execute(sql`insert into mcp_audit_log (artist_id, field, action, old_value, new_value, api_key_hash)
        select id, 'claim_profile_cleanup_deferred', 'delete', custom_image,
          'Object retained; generation verification required before cleanup', ${auditKey}
        from artists where ${managed}`);
      await tx.execute(sql`update artists set custom_image = null where ${managed}`);
    }
    // Removing the job identity invalidates a running model call; its guarded write can't recreate the Lore.
    for (const table of [
      "artist_research_jobs",
      "artist_social_credits",
      "artist_doc_corrections",
    ] as const)
      await tx.execute(
        sql`delete from ${sql.identifier(table)} where artist_id = ${artistId}::uuid`,
      );
    if (removable.length)
      await tx.execute(sql`delete from artist_vault_sources
        where artist_id = ${artistId}::uuid
        and id in (${sql.join(
          removable.map(source => sql`${source.id}::uuid`),
          sql`, `,
        )})`);
    // A record of files to review, not permission to delete keys a retained source still uses.
    const retainedPaths = new Set(
      sources.filter(source => !removable.includes(source)).map(source => source.filePath),
    );
    const deferred = JSON.stringify({
      claimId,
      sources: removable.map(source => ({
        id: source.id,
        filePath: retainedPaths.has(source.filePath) ? null : source.filePath,
      })),
    });
    await tx.execute(sql`insert into mcp_audit_log (artist_id, field, action, old_value, new_value, api_key_hash)
      values (${artistId}::uuid, 'claim_cleanup_deferred', 'delete', ${deferred},
        'Storage cleanup deferred: object generation cannot be verified; no prefix deletion authorized.', ${auditKey})`);
    // The next claimant must not inherit social history or onboarding.
    for (const table of [
      "artist_social_posts",
      "artist_social_refreshes",
      "artist_social_profiles",
      "artist_interview_answers",
      "artist_onboarding_steps",
    ] as const)
      await tx.execute(
        sql`delete from ${sql.identifier(table)} where artist_id = ${artistId}::uuid`,
      );
    const deletedDocs = rowsOf(
      await tx.execute(
        sql`delete from artist_docs where artist_id = ${artistId}::uuid returning artist_id`,
      ),
    );
    // Revocation is the moderation exception to pinning: keep history, never leave a locked bio.
    const unpinned = rowsOf(
      await tx.execute(sql`update artist_bio_versions set is_pinned = false
        where artist_id = ${artistId}::uuid and is_pinned = true returning artist_id`),
    );
    if (deletedDocs.length > 0 || unpinned.length > 0) {
      const provenance = await readBioProvenance(tx, artistId);
      await prepareBioUrlReceipts(tx, provenance);
      const [current] = rowsOf(
        await tx.execute(sql`select bio from artists where id = ${artistId}::uuid`),
      ) as { bio: string | null }[];
      await saveBioVersions(tx, artistId, [current?.bio], [provenance]);
      await writeBioProvenance(tx, artistId, null);
      await markAboutWriter(tx);
      await tx.execute(sql`update artists set bio = null where id = ${artistId}::uuid`);
    }
    return deleted;
  });
}

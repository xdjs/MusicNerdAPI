import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import type { ApprovedSubmission } from "@/lib/contributorApprovals/types";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";

/**
 * Approves one of the contributor's pending Lore sources in one transaction:
 * the reviewer is rechecked as an admin, the artist is locked, and only a
 * pending source the contributor submitted or uploaded changes. Records the
 * approval and queues its text extraction.
 *
 * @param adminId - The reviewing admin.
 * @param sourceId - The source.
 * @param contributorId - The contributor the source must belong to.
 * @returns The artist and its approved claim, or null when there was nothing to approve.
 */
export async function approveContributorSource(
  adminId: string,
  sourceId: string,
  contributorId: string,
): Promise<ApprovedSubmission | null> {
  return db.transaction(async tx => {
    const [admin] = await tx.execute<{ is_admin: boolean }>(
      sql`select is_admin from users where id = ${adminId}::uuid for share`,
    );
    if (!admin?.is_admin) throw new Error("Admin access required.");

    const [candidate] = await tx.execute<{ artist_id: string }>(
      sql`select artist_id from artist_vault_sources where id = ${sourceId}::uuid`,
    );
    if (!candidate) return null;
    const artistId = String(candidate.artist_id);
    await lockArtistRow(tx, artistId);
    const [source] = await tx.execute<Record<string, unknown>>(sql`
      update artist_vault_sources s set status = 'approved', updated_at = now()
      where s.id = ${sourceId}::uuid and s.artist_id = ${artistId}::uuid and s.status = 'pending'
        and s.origin in ('submission', 'upload')
        and exists (select 1 from artist_activity_events e where e.id = s.activity_id and e.actor_user_id = ${contributorId}::uuid)
      returning s.id, s.url, s.status, s.file_path, s.extracted_text
    `);
    if (!source) return null;
    const activityId = await recordArtistActivity(
      artistId,
      "source_approved",
      { userId: adminId, sourceId, trigger: "admin_bulk_review" },
      tx,
    );
    await queueApprovedSourceExtraction(
      tx,
      {
        id: sourceId,
        artistId,
        url: String(source.url),
        status: String(source.status),
        filePath: source.file_path as string | null,
        extractedText: source.extracted_text as string | null,
      },
      activityId,
    );
    const claim = await findApprovedClaim(tx, artistId);
    return { artistId, lore: true, claimId: claim?.id ?? null };
  });
}

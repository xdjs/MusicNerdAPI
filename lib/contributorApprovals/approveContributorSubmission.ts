import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { approveUGC } from "@/lib/artistLinkReview/approveUGC";
import { approveContributorSource } from "@/lib/contributorApprovals/approveContributorSource";
import type { ApprovedSubmission, ContributorSubmission } from "@/lib/contributorApprovals/types";
import { db } from "@/lib/db/db";

/**
 * Approves one of the contributor's pending submissions. A link is written to
 * the artist and recorded in one transaction, with the reviewer, contributor
 * and pending state rechecked; a Lore source or upload goes through
 * approveContributorSource.
 *
 * @param adminId - The reviewing admin.
 * @param contributorId - The contributor the submission must belong to.
 * @param item - The submission.
 * @returns What changed, or null when there was nothing to approve.
 */
export async function approveContributorSubmission(
  adminId: string,
  contributorId: string,
  item: ContributorSubmission,
): Promise<ApprovedSubmission | null> {
  if (item.type !== "link") return approveContributorSource(adminId, item.id, contributorId);
  return db.transaction(async tx => {
    const [admin] = await tx.execute<{ is_admin: boolean }>(
      sql`select is_admin from users where id = ${adminId}::uuid for share`,
    );
    if (!admin?.is_admin) throw new Error("Admin access required.");

    const [link] = await tx.execute<Record<string, unknown>>(sql`
      select id, artist_id, site_name, site_username from ugcresearch
      where id = ${item.id}::uuid and user_id = ${contributorId}::uuid and origin = 'submission'
        and accepted is not true and date_processed is null and artist_id is not null
        and site_name is distinct from 'ugc_discord_ping' for update
    `);
    if (!link) return null;
    const artistId = String(link.artist_id);
    await approveUGC(
      String(link.id),
      artistId,
      String(link.site_name ?? ""),
      String(link.site_username ?? ""),
      tx,
    );
    await recordArtistActivity(
      artistId,
      "link_approved",
      { userId: adminId, sourceId: item.id, trigger: "admin_bulk_review" },
      tx,
    );
    return { artistId, lore: false };
  });
}

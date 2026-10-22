import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import type { TransactionDb } from "@/lib/ownership/types";
import { queueApprovedSourceExtraction } from "@/lib/sourceExtraction/queueApprovedSourceExtraction";

/**
 * Approves a UGC suggestion for an Apple Music or Beatport page by filing it
 * as an approved Lore source, keeping the original contributor and date, then
 * queues its extraction and marks the UGC row accepted.
 *
 * @param tx - The review's transaction, with the artist locked.
 * @param artistId - The artist.
 * @param userId - The reviewing user.
 * @param row - The ugcresearch row, as selected.
 * @returns Nothing; throws ArtistLinkConflictError when the URL is already in Lore.
 */
export async function approveSourceBackedUgc(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  row: Record<string, unknown>,
): Promise<void> {
  const [source] = await tx.execute<{
    id: string;
  }>(sql`insert into artist_vault_sources(artist_id,url,title,type,status,origin,created_at)
    values(${artistId}::uuid,${String(row.ugc_url)},${String(row.site_name)},'profile','approved',${String(row.origin ?? "unknown")},coalesce(${row.created_at ? String(row.created_at) : null}::timestamp at time zone 'UTC',now()))
    on conflict(artist_id,url) do nothing returning id`);
  if (!source)
    throw new ArtistLinkConflictError(
      "This URL already exists in Lore. Review that source instead.",
    );
  const sourceId = String(source.id);
  const submittedActivity = await recordArtistActivity(
    artistId,
    "source_submission",
    {
      sourceId,
      userId: row.user_id ? String(row.user_id) : undefined,
      actorKind: row.origin === "research" ? "system" : "unknown",
      trigger: "legacy_link_submission",
    },
    tx,
  );
  await tx.execute(
    sql`update artist_vault_sources set activity_id=${submittedActivity}::uuid where id=${sourceId}::uuid`,
  );
  const reviewActivity = await recordArtistActivity(
    artistId,
    "source_approved",
    { sourceId, userId, trigger: "artist_link_review" },
    tx,
  );
  await queueApprovedSourceExtraction(
    tx,
    { id: sourceId, artistId, url: String(row.ugc_url), status: "approved" },
    reviewActivity,
  );
  await tx.execute(
    sql`update ugcresearch set accepted=true,date_processed=now(),updated_at=now() where id=${String(row.id)}::uuid`,
  );
}

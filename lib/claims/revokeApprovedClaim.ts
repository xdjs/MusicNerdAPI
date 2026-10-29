import { sql } from "drizzle-orm";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { claimColumns } from "@/lib/claims/claimColumns";
import type { ClaimRow } from "@/lib/claims/types";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";

/** What the claimant added, deleted with the claim so the next claimant starts clean. */
const CLAIMANT_TABLES = [
  "artist_research_jobs",
  "artist_social_credits",
  "artist_doc_corrections",
  "artist_vault_sources",
  "artist_social_posts",
  "artist_social_refreshes",
  "artist_social_profiles",
  "artist_interview_answers",
  "artist_onboarding_steps",
] as const;

/**
 * Deletes an approved claim and, in the same transaction, what its claimant
 * added: research jobs, sources, social data, corrections, interview answers,
 * onboarding steps and the Lore. A pinned bio is unpinned and the page's bio
 * kept in history, then cleared. The delete only matches a claim that is still
 * approved, so a concurrent status change makes this a no-op. Stored files are
 * the caller's to purge.
 *
 * @param claimId - The claim.
 * @returns The deleted claim, or undefined when it isn't (or is no longer) approved.
 */
export async function revokeApprovedClaim(claimId: string): Promise<ClaimRow | undefined> {
  return db.transaction(async tx => {
    const [deleted] = rowsOf(
      await tx.execute(sql`delete from artist_claims
        where id = ${claimId}::uuid and status = 'approved'
        returning ${claimColumns}`),
    ) as ClaimRow[];
    if (!deleted) return undefined;
    const artistId = deleted.artistId;
    await lockArtistRow(tx, artistId);
    for (const table of CLAIMANT_TABLES)
      await tx.execute(
        sql`delete from ${sql.identifier(table)} where artist_id = ${artistId}::uuid`,
      );
    const deletedDocs = rowsOf(
      await tx.execute(
        sql`delete from artist_docs where artist_id = ${artistId}::uuid returning artist_id`,
      ),
    );
    const unpinned = rowsOf(
      await tx.execute(sql`update artist_bio_versions set is_pinned = false
        where artist_id = ${artistId}::uuid and is_pinned = true returning artist_id`),
    );
    if (deletedDocs.length > 0 || unpinned.length > 0) {
      await tx.execute(sql`insert into artist_bio_versions (artist_id, bio_text, is_pinned)
        select id, bio, false from artists a
        where id = ${artistId}::uuid and bio is not null
        and btrim(bio, E' \\t\\n\\r') <> '' and btrim(bio, E' \\t\\n\\r') <> ${ABOUT_EMPTY_STATE}
        and not exists (select 1 from artist_bio_versions v
          where v.artist_id = a.id and v.bio_text = a.bio)`);
      await tx.execute(sql`update artists set bio = null where id = ${artistId}::uuid`);
    }
    return deleted;
  });
}

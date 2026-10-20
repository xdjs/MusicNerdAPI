import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { isRealBio } from "@/lib/bio/isRealBio";
import { saveBioVersions } from "@/lib/bio/saveBioVersions";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { getCorrectionAbout } from "@/lib/bioCorrections/getCorrectionAbout";
import { db } from "@/lib/db/db";

/**
 * Saves an admin's corrected About and resolves the report, in one
 * transaction: the About, its history, the activity record and the review.
 *
 * @param reportId - The pending report.
 * @param userId - The admin.
 * @param bio - The corrected About.
 * @param revision - The revision the admin edited, from `getCorrectionAbout`.
 * @returns Nothing. Throws `CorrectionAboutConflict` when the bio is invalid or anything changed since the read.
 */
export async function saveCorrectionAbout(
  reportId: string,
  userId: string,
  bio: string,
  revision: string,
): Promise<void> {
  if (!isRealBio(bio) || bio.length > MAX_BIO_LENGTH)
    throw new CorrectionAboutConflict("Enter an About of up to 10,000 characters.");
  await db.transaction(async tx => {
    const [admin] = await tx.execute(
      sql`select id from users where id=${userId}::uuid and is_admin=true`,
    );
    if (!admin) throw new CorrectionAboutConflict("Administrator access is required.");
    // Same artist-first lock order as bio, pin, claim and research writers.
    const [artist] = await tx.execute<{ id: string }>(sql`select a.id from artists a
      join artist_bio_corrections r on r.artist_id=a.id where r.id=${reportId}::uuid for update of a`);
    if (!artist) throw new CorrectionAboutConflict("This report no longer exists.");
    await tx.execute(
      sql`select id from artist_bio_corrections where id=${reportId}::uuid for update`,
    );
    await tx.execute(
      sql`select artist_id from artist_directory_preparations where artist_id=${artist.id}::uuid for update`,
    );
    const current = await getCorrectionAbout(reportId, tx);
    if (current.revision !== revision)
      throw new CorrectionAboutConflict(
        "The About or artist ownership changed. Your draft is kept; cancel and reopen the editor to review the latest version.",
      );
    await saveBioVersions(tx, artist.id, [current.bio, bio]);
    if (current.claimed) {
      await tx.execute(sql`update artists set bio=${bio} where id=${artist.id}::uuid`);
    } else {
      // Keep identity/source gates and the private pre-claim preparation untouched.
      await tx.execute(sql`update artist_directory_preparations
        set public_about=public_about || jsonb_build_object('bio',${bio}::text,'kind','researched','editedByAdmin',true), updated_at=now()
        where artist_id=${artist.id}::uuid`);
    }
    await recordArtistActivity(
      artist.id,
      "about_edited",
      { userId, trigger: "about_correction" },
      tx,
    );
    await tx.execute(sql`update artist_bio_corrections
      set status='resolved', reviewed_at=now(), reviewed_by=${userId}::uuid where id=${reportId}::uuid`);
  });
}

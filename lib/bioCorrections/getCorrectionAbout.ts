import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getPublicArtistAbout } from "@/lib/bio/getPublicArtistAbout";
import { isRealBio } from "@/lib/bio/isRealBio";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { db } from "@/lib/db/db";

/**
 * The About a pending bio-correction report is about: `artists.bio` once
 * claimed, the published directory About before. Admin only; callers
 * authorize first, and raw preparation never leaves the server.
 *
 * @param reportId - The report.
 * @param reader - The connection or transaction to read with.
 * @returns The bio, a revision hash of every input, the artist and whether it's claimed. Throws `CorrectionAboutConflict` when it can't be edited.
 */
export async function getCorrectionAbout(
  reportId: string,
  reader: Pick<typeof db, "execute"> = db,
): Promise<{ bio: string; revision: string; artistId: string; claimed: boolean }> {
  const [row] = await reader.execute<{
    artist_id: string;
    bio: string | null;
    claim_id: string | null;
    public_about: unknown;
    pinned: boolean;
    status: string;
  }>(sql`select r.artist_id, a.bio, r.status, p.public_about,
    (select c.id from artist_claims c where c.artist_id=a.id and c.status='approved' limit 1) claim_id,
    exists(select 1 from artist_bio_versions v where v.artist_id=a.id and v.is_pinned) pinned
    from artist_bio_corrections r join artists a on a.id=r.artist_id
    left join artist_directory_preparations p on p.artist_id=a.id where r.id=${reportId}::uuid`);
  if (!row || row.status !== "pending")
    throw new CorrectionAboutConflict("This report has already been reviewed or no longer exists.");
  if (row.pinned)
    throw new CorrectionAboutConflict(
      "This About is pinned. Unpin it on the artist profile before editing.",
    );
  const about = row.claim_id ? null : await getPublicArtistAbout(row.artist_id, reader);
  const bio = row.claim_id ? row.bio : about?.bio;
  if (!bio || !isRealBio(bio))
    throw new CorrectionAboutConflict(
      "The published About is no longer available. Review the artist profile before resolving this report.",
    );
  const revision = createHash("sha256")
    .update(JSON.stringify([row.artist_id, row.claim_id, row.bio, row.public_about, bio]))
    .digest("hex");
  return { bio, revision, artistId: row.artist_id, claimed: !!row.claim_id };
}

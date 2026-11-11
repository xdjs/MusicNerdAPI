import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import type { DiscoveredProfile } from "@/lib/discovery/types";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";

/**
 * Retains an unresolved automated discovery in the existing link-review queue.
 * Rechecks the operation under the artist lock and preserves all prior decisions.
 * No account is attached and no contributor is represented as endorsing the match.
 * Returns true for unresolved candidates; false for a previously reviewed identity.
 */
export async function saveDiscoveredLinkSuggestion(
  artistId: string,
  profile: Pick<DiscoveredProfile, "siteName" | "value" | "profileUrl">,
): Promise<boolean> {
  if (!getArtistOperationOwnership(artistId)) throw new Error("Artist operation required");
  return db.transaction(async tx => {
    await lockScopedArtistWrite(tx, artistId);
    const [existing] = await tx.execute<{
      id: string;
      accepted: boolean;
      date_processed: string | null;
    }>(sql`select id,accepted,date_processed from ugcresearch
      where artist_id=${artistId}::uuid and
      (ugc_url=${profile.profileUrl} or (site_name=${profile.siteName} and (site_username=${profile.value} or
      (${["instagram", "x"].includes(profile.siteName)} and lower(site_username)=lower(${profile.value})))))
      order by (accepted is true or date_processed is not null) desc
      limit 1`);
    if (existing) return !existing.accepted && existing.date_processed === null;
    await tx.execute(sql`insert into ugcresearch(artist_id,ugc_url,site_name,site_username,origin,accepted)
      values(${artistId}::uuid,${profile.profileUrl},${profile.siteName},${profile.value},'research',false)`);
    return true;
  });
}

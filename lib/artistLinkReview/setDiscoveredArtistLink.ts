import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import type { CatalogWriteEvidence } from "@/lib/providerIdentity/types";

/** Rechecks review decisions under the same artist lock as an automatic attachment. */
export async function setDiscoveredArtistLink(
  artistId: string,
  siteName: string,
  value: string,
  evidence?: CatalogWriteEvidence,
) {
  if (!getArtistOperationOwnership(artistId)) throw new Error("Artist operation required");
  return db.transaction(async tx => {
    if (["spotify", "deezer"].includes(siteName))
      await acquireArtistPlatformWriteLocks(tx, artistId, siteName, value);
    await lockScopedArtistWrite(tx, artistId);
    const [decision] = await tx.execute(sql`select id from ugcresearch
      where artist_id=${artistId}::uuid and site_name=${siteName}
      and (site_username=${value} or (${["instagram", "x"].includes(siteName)} and lower(site_username)=lower(${value}))) limit 1`);
    if (decision)
      throw new ArtistLinkConflictError(
        "This account has a review record; explicit confirmation is required",
      );
    return setArtistLink(artistId, siteName, value, undefined, tx, evidence);
  });
}

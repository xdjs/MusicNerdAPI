import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { reviewArtistLinkSuggestion } from "@/lib/artistLinkReview/reviewArtistLinkSuggestion";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

/** Applies an explicit onboarding confirmation through the existing atomic review flow. */
export async function approveDiscoveredLinkSuggestion(
  artistId: string,
  siteName: string,
  value: string,
): Promise<boolean> {
  const userId = getArtistOperationOwnership(artistId)?.userId;
  if (!userId) return false;
  const [suggestion] = await db.execute<{ id: string }>(sql`select id from ugcresearch
    where artist_id=${artistId}::uuid and site_name=${siteName}
    and (site_username=${value} or (${["instagram", "x"].includes(siteName)} and lower(site_username)=lower(${value})))
    and accepted is not true and date_processed is null order by created_at,id limit 1`);
  if (!suggestion) return false;
  await reviewArtistLinkSuggestion(artistId, userId, {
    kind: "ugc",
    id: suggestion.id,
    decision: "approve",
  });
  return true;
}

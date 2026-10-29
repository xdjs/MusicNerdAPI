import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { storedInstagramThumbnail } from "@/lib/instagram/storedInstagramThumbnail";
/** Read already-retained public own-post images; never fetch providers or trust raw CDN URLs. */
export async function loadCanvasSocialMedia(artistId: string) {
  const rows = await db.execute<{ url: string; platform_post_id: string; raw: unknown }>(sql`
    select url,platform_post_id,raw from artist_social_posts
    where artist_id=${artistId}::uuid and platform='instagram' and is_own_post=true
    and coalesce(raw->>'isRepost','false')!='true' and coalesce(raw->>'isRetweet','false')!='true'
    order by posted_at desc nulls last,id limit 500`);
  const media = new Map<string, string>();
  for (const row of rows) {
    const retained = storedInstagramThumbnail(row.raw, artistId, row.platform_post_id);
    if (typeof retained?.url === "string") media.set(row.url, retained.url);
  }
  return media;
}

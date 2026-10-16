import { sql } from "drizzle-orm";
import type { db } from "@/lib/db/db";

/** Call inside the identity edit's transaction, including an explicit removal of an already-empty slot. */
export async function cancelSpotifyMatchForIdentityEdit(
  writer: Pick<typeof db, "execute">,
  artistId: string,
): Promise<void> {
  await writer.execute(sql`
    update artist_research_jobs set status='done',claimed_at=null,updated_at=clock_timestamp(),
      state=state || '{"identityChanged":true,"outcome":"identity_changed"}'::jsonb
    where artist_id=${artistId}::uuid and kind='spotify_match' and status in ('pending','running')
  `);
}

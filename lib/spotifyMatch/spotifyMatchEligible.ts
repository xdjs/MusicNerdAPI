import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ResearchJob } from "@/lib/research/types";
import type { SpotifyMatchState } from "./types";

/** Public identity-only authority: claim arrival is allowed; changes, exclusions and rejection are not. */
export async function spotifyMatchEligible(
  job: ResearchJob,
  state: SpotifyMatchState,
  reader: Pick<typeof db, "execute"> = db,
): Promise<boolean> {
  if (
    state.identityChanged ||
    state.creationActivityId !== job.activityId ||
    state.directoryActivityId !== job.activityId
  )
    return false;
  const rows = rowsOf(
    await reader.execute(sql`
    select j.id from artist_research_jobs j
    join artists a on a.id=j.artist_id
    join artist_activity_events e on e.id=j.activity_id and e.artist_id=a.id
    where j.id=${job.id}::uuid and j.artist_id=${job.artistId}::uuid
      and j.kind='spotify_match' and j.status='running' and j.updated_at=${job.updatedAt}::timestamptz
      and coalesce(j.state->>'identityChanged','false')<>'true'
      and e.id=${state.creationActivityId}::uuid and e.actor_kind='user'
      and e.action='directory_add' and e.trigger='directory_add' and e.actor_user_id=a.added_by
      and a.deezer=${state.deezerId} and a.name=${state.artistName} and nullif(btrim(a.spotify),'') is null
      and not exists(select 1 from artist_mapping_exclusions x where x.artist_id=a.id and x.platform in ('spotify','deezer'))
      and not exists(select 1 from artist_self_edits s where s.artist_id=a.id and s.site_name in ('spotify','deezer') and s.created_at>=j.created_at)
      and not exists(select 1 from artist_vault_sources s where s.artist_id=a.id and s.status='rejected'
        and s.url ~* '^https?://(www\\.)?open\\.spotify\\.com/(intl-[a-z]{2}/)?artist/')
  `),
  );
  return rows.length > 0;
}

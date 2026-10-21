import { and, eq, sql } from "drizzle-orm";
import { getArtistById } from "@/lib/artists/getArtistById";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { artistVaultSources } from "@/lib/db/schema";
import { publicLinkRevision } from "@/lib/directoryDiscovery/publicLinkRevision";
import type { DirectoryDiscoveryStatus } from "@/lib/directoryDiscovery/types";
import { getArtistLinks } from "@/lib/links/getArtistLinks";
import { getHiddenLinkSourceIds } from "@/lib/links/getHiddenLinkSourceIds";
import { getConflictingMusicSourceIds } from "@/lib/musicLinks/getConflictingMusicSourceIds";

const STATES = ["active", "complete", "failed", "stopped"];

/**
 * Where the research started by adding an artist to the directory stands, for
 * the account that added it or an admin, within 24 hours of the add. The read
 * is private; the answer is public-only: a state and a fingerprint of the
 * profile's public links. Never advances or creates work.
 *
 * @param artistId - The artist.
 * @param userId - The viewer.
 * @returns The state and link revision, or null when there is nothing this viewer may observe. Throws on a failed read.
 */
export async function getDirectoryDiscoveryStatus(
  artistId: string,
  userId: string,
): Promise<DirectoryDiscoveryStatus | null> {
  const rows = rowsOf(
    await db.execute(sql`
    select case
      when exists(select 1 from artist_claims c where c.artist_id=a.id) then 'stopped'
      when directory_jobs.active or directory_jobs.awaiting_handoff then 'active'
      when directory_jobs.unfinished then 'failed'
      else 'complete' end as state
    from artists a
    join users viewer on viewer.id=${userId}::uuid
    join artist_activity_events creation on creation.artist_id=a.id
      and creation.action='directory_add' and creation.trigger='directory_add'
      and creation.actor_kind='user' and creation.actor_user_id=a.added_by
    join artist_research_jobs parent on parent.artist_id=a.id and parent.activity_id=creation.id
      and parent.kind='source_search' and parent.state->>'purpose'='directory_preparation'
      and parent.state->>'creationActivityId'=creation.id::text
    cross join lateral (
      select bool_or(j.status in ('pending','running','queued') and j.attempts < 4) as active,
        bool_or(j.status <> 'done') as unfinished,
        bool_or(j.kind='social_ingest' and j.status='done' and not exists (
          select 1 from artist_research_jobs child where child.artist_id=a.id
            and child.kind='caption_extract'
            and child.state->>'directoryActivityId'=creation.id::text
        )) as awaiting_handoff
      from artist_research_jobs j
      left join artist_activity_events activity on activity.id=j.activity_id
      where j.artist_id=a.id and j.kind in ('source_search','lore_refresh','social_ingest','caption_extract','source_extract','spotify_match')
        and (j.activity_id=creation.id or activity.parent_activity_id=creation.id
          or j.state->>'directoryActivityId'=creation.id::text
          or j.state->>'creationActivityId'=creation.id::text)
    ) directory_jobs
    where a.id=${artistId}::uuid and a.created_at > now()-interval '24 hours'
      and a.created_at <= now() and (viewer.is_admin or creation.actor_user_id=viewer.id)
    limit 1
  `),
  ) as { state?: unknown }[];
  const state = rows[0]?.state;
  if (state === undefined) return null;
  if (!STATES.includes(String(state))) throw new Error("Invalid discovery status");
  // Read destinations after the status, so a worker's final write is never missed.
  const artist = await getArtistById(artistId);
  if (!artist) return null;
  const sources = await db.query.artistVaultSources.findMany({
    columns: {
      id: true,
      url: true,
      type: true,
      status: true,
      podcastEpisodeKey: true,
      filePath: true,
    },
    where: and(
      eq(artistVaultSources.artistId, artistId),
      eq(artistVaultSources.status, "approved"),
    ),
    orderBy: (sources, { desc }) => [desc(sources.createdAt)],
  });
  const [links, conflicts, hidden] = await Promise.all([
    getArtistLinks(artist),
    getConflictingMusicSourceIds(artistId, sources),
    getHiddenLinkSourceIds(artistId),
  ]);
  return {
    state: state as DirectoryDiscoveryStatus["state"],
    revision: publicLinkRevision(artist, links, sources, [...conflicts, ...hidden]),
  };
}

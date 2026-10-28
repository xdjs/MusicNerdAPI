import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ResearchJob } from "@/lib/research/types";
import type { CatalogMatchState, CatalogMatchEligibility } from "./types";
/** Check the exact live lease and public identity snapshot; never reinterpret exclusions as user consent. */
export async function catalogMatchEligibility(
  job: ResearchJob,
  state: CatalogMatchState,
  reader: Pick<typeof db, "execute"> = db,
): Promise<CatalogMatchEligibility> {
  const [row] = rowsOf(
    await reader.execute(sql`
 SELECT a.name,a.spotify,a.deezer,
 musicnerd_private.catalog_link_was_disconnected(a.id,${state.anchor.spotify ? "deezer" : "spotify"}) OR (${!state.anchor.spotify && !state.anchor.deezer} AND musicnerd_private.catalog_link_was_disconnected(a.id,'deezer')) AS disconnected,
 EXISTS(SELECT 1 FROM artist_mapping_exclusions e WHERE e.artist_id=a.id AND e.platform IN ('spotify','deezer')) AS excluded,
 EXISTS(SELECT 1 FROM artist_research_jobs legacy WHERE legacy.artist_id=a.id AND legacy.kind='spotify_match' AND legacy.status IN ('pending','running')) AS legacy
 FROM artist_research_jobs j JOIN artists a ON a.id=j.artist_id
 WHERE j.id=${job.id}::uuid AND j.artist_id=${job.artistId}::uuid AND j.kind='catalog_match'
 AND j.status='running' AND j.updated_at=${job.updatedAt}::timestamptz
 AND j.state->'anchor'=${JSON.stringify(state.anchor)}::jsonb
 `),
  ) as {
    name: string;
    spotify: string | null;
    deezer: string | null;
    disconnected: boolean;
    excluded: boolean;
    legacy: boolean;
  }[];
  if (!row) return "stale";
  if (
    row.name !== state.anchor.name ||
    row.spotify !== state.anchor.spotify ||
    row.deezer !== state.anchor.deezer
  )
    return "identity_changed";
  if (row.disconnected) return "user_disconnected";
  if (row.legacy) return "legacy_running";
  return row.excluded ? "exclusion_review_required" : "eligible";
}

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { RESEARCH_REFRESH_COOLDOWN_MS } from "@/lib/research/const";
import { readEditorSourceSearch } from "./readEditorSourceSearch";

/** Records an authenticated search once, retaining its receipt across ordinary job reset/deletion. */
export async function requestEditorSourceSearch(
  artistId: string,
  userId: string,
  requestId: string,
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const prior = await readEditorSourceSearch(tx, artistId, userId, requestId);
    if (prior) return prior;
    const [live] = await tx.execute(
      sql`select id from artist_research_jobs where artist_id=${artistId}::uuid and kind='source_search' and status in ('pending','running') limit 1`,
    );
    if (live) throw new KnowledgeError("search_active", 409, "A source search is already active");
    const [recent] = await tx.execute(
      sql`select id from artist_activity_events where artist_id=${artistId}::uuid and action='source_search' and trigger='editor_search' and created_at > now()-(${RESEARCH_REFRESH_COOLDOWN_MS} * interval '1 millisecond') limit 1`,
    );
    if (recent)
      throw new KnowledgeError(
        "search_cooldown",
        429,
        "Source search can be requested again after 30 minutes",
      );
    const claimId = (await findApprovedClaim(tx, artistId))?.id ?? null;
    const [receipt] = await tx.execute(
      sql`insert into artist_activity_events(id,artist_id,actor_user_id,actor_kind,action,trigger) values(${requestId}::uuid,${artistId}::uuid,${userId}::uuid,'user','source_search','editor_search') on conflict do nothing returning id`,
    );
    if (!receipt)
      throw new KnowledgeError("request_conflict", 409, "Request identifier is already in use");
    await tx.execute(
      sql`insert into artist_research_jobs(id,artist_id,kind,activity_id,state) values(${requestId}::uuid,${artistId}::uuid,'source_search',${requestId}::uuid,${JSON.stringify({ mode: "editor_source_search", claimId })}::jsonb)`,
    );
    return (await readEditorSourceSearch(tx, artistId, userId, requestId))!;
  });
}

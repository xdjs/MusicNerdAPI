import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ResearchJob } from "@/lib/research/types";

/** Fences every editor-search checkpoint to its exact lease; authorizes before marking a paid start. */
export async function checkpointEditorSourceSearch(
  job: ResearchJob,
  phase: "start" | "pending" | "done" | "failed" | "interrupted",
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, job.artistId);
    const [current] = await tx.execute<{ state: Record<string, unknown> }>(
      sql`select state from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and kind='source_search' and status='running' and updated_at=${job.updatedAt}::timestamptz for update`,
    );
    if (!current || current.state.mode !== "editor_source_search") return null;
    let userId: string | undefined;
    if (phase === "start") {
      if (current.state.executionStarted) return null;
      const [event] = await tx.execute<{ actor_user_id: string | null }>(
        sql`select actor_user_id from artist_activity_events where id=${job.activityId}::uuid and artist_id=${job.artistId}::uuid and actor_kind='user' and action='source_search' and trigger='editor_search'`,
      );
      if (!event?.actor_user_id) throw new Error("Search requester unavailable");
      userId = event.actor_user_id;
      await authorizeLockedArtistWrite(tx, job.artistId, {
        userId,
        expectedClaimId: typeof current.state.claimId === "string" ? current.state.claimId : null,
      });
    }
    const state: Record<string, unknown> = {
      ...current.state,
      ...(phase === "start" ? { executionStarted: true } : { phase }),
    };
    const status = phase === "start" ? "running" : phase === "interrupted" ? "failed" : phase;
    // Keep the exact lease timestamp for all checkpoints in this invocation.
    await tx.execute(
      sql`update artist_research_jobs set state=${JSON.stringify(state)}::jsonb,status=${status},claimed_at=case when ${status}='running' then claimed_at else null end where id=${job.id}::uuid and status='running' and updated_at=${job.updatedAt}::timestamptz`,
    );
    return { userId, state };
  });
}

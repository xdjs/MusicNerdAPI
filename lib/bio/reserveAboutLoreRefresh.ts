import { limitAboutTransaction } from "@/lib/bio/limitAboutTransaction";
import { sql } from "drizzle-orm";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { rowsOf } from "@/lib/db/rowsOf";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { assertLoreSourcesCurrent } from "@/lib/lore/assertLoreSourcesCurrent";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import type { DocSource } from "@/lib/lore/types";
import { MAX_ATTEMPTS } from "@/lib/research/const";

/** Reserve only an ordinary pending Lore rebuild, sharing the cron worker's live slot and lease. */
export async function reserveAboutLoreRefresh(
  artistId: string,
  auth: ArtistWriteAuth,
): Promise<
  | { status: "busy" }
  | {
      status: "acquired";
      jobId: string;
      requestedAt: string;
      claimedAt: string;
      needsRefresh?: boolean;
    }
> {
  return db.transaction(async tx => {
    await limitAboutTransaction(tx);
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, auth);
    const jobs = rowsOf(
      await tx.execute(sql`
      select id, state from artist_research_jobs
      where artist_id=${artistId}::uuid and kind='lore_refresh' and status in ('pending','running')
      limit 1`),
    ) as { id: string; state: Record<string, unknown> }[];
    const job = jobs[0];
    if (job) {
      // A directory preparation has other responsibilities. Never run it as a
      // shortcut, or change its claim/intent to make it fit this action.
      if (job.state?.purpose || job.state?.claimId !== auth.expectedClaimId)
        return { status: "busy" };
      const claimed = rowsOf(
        await tx.execute(sql`
        update artist_research_jobs set status='running', claimed_at=now(), updated_at=now(), state=state - 'aboutOnly'
        where id=${job.id}::uuid and status='pending' and claimed_at is null
          and attempts < ${MAX_ATTEMPTS}
        returning id, claimed_at::text as claimed_at, coalesce(state->>'requestedAt','') as requested_at
      `),
      ) as { id: string; claimed_at: string; requested_at: string }[];
      return claimed[0]
        ? {
            status: "acquired",
            jobId: claimed[0].id,
            requestedAt: claimed[0].requested_at,
            claimedAt: claimed[0].claimed_at,
          }
        : { status: "busy" };
    }
    const docs = rowsOf(
      await tx.execute(sql`
      select content,sources from artist_docs where artist_id=${artistId}::uuid limit 1
    `),
    ) as { content: string; sources: DocSource[] | null }[];
    let needsRefresh = true;
    if (docs[0]?.content?.trim()) {
      try {
        await assertLoreSourcesCurrent(tx, artistId, docs[0].sources ?? []);
        needsRefresh = false;
      } catch (error) {
        if (!(error instanceof LoreChangedError)) throw error;
      }
    }
    const activityId = await recordArtistActivity(
      artistId,
      "lore_refresh",
      {
        userId: auth.userId,
        trigger: "about_editor",
      },
      tx,
    );
    const claimed = rowsOf(
      await tx.execute(sql`
      insert into artist_research_jobs(artist_id,kind,status,claimed_at,state,activity_id)
      values(${artistId}::uuid,'lore_refresh','running',now(),${JSON.stringify({ claimId: auth.expectedClaimId, ...(!needsRefresh ? { aboutOnly: true } : {}) })}::jsonb,${activityId}::uuid)
      on conflict (artist_id,kind) where status in ('pending','running') do nothing
      returning id, claimed_at::text as claimed_at
    `),
    ) as { id: string; claimed_at: string }[];
    return claimed[0]
      ? {
          status: "acquired",
          jobId: claimed[0].id,
          requestedAt: "",
          needsRefresh,
          claimedAt: claimed[0].claimed_at,
        }
      : { status: "busy" };
  });
}

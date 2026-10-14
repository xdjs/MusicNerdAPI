import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

type Saved = {
  id: string;
  kind: string;
  status: string;
  cursor: number;
  total: number | null;
  attempts: number;
  state: Record<string, unknown>;
};
/** Under the artist lock, replace directory descendants with claim-owned jobs, preserving paid progress. */
export async function resumeDirectorySocialJobs(
  tx: TransactionDb,
  artistId: string,
  claimId: string,
  activityId: string | null,
  force = false,
): Promise<boolean> {
  if (
    !rowsOf(
      await tx.execute(
        sql`select id from artist_claims where id=${claimId}::uuid and artist_id=${artistId}::uuid and status='approved'`,
      ),
    ).length
  )
    throw new OwnershipChangedError();
  const prior = rowsOf(
    await tx.execute(sql`
    select j.id,j.kind,j.status,j.cursor,j.total,j.attempts,j.state from artist_research_jobs j
    join artists a on a.id=j.artist_id
    join artist_activity_events e on e.artist_id=a.id and e.id::text=j.state->>'directoryActivityId'
    where a.id=${artistId}::uuid and e.actor_kind='user' and e.actor_user_id=a.added_by and e.action='directory_add' and e.trigger='directory_add'
      and j.kind in ('social_ingest','caption_extract') order by j.created_at desc,j.id desc for update of j`),
  ) as Saved[];
  if (!prior.length) return false;
  if (prior.some(j => j.state.directoryHandedOffToClaim === claimId)) return !force;
  const social = prior.find(j => j.kind === "social_ingest"),
    caption = prior.find(j => j.kind === "caption_extract");
  const pending: Saved[] = [];
  if (social && social.state.directorySocialComplete !== true) pending.push(social);
  if (caption && caption.state.directoryCaptionsComplete !== true) pending.push(caption);
  else if (!caption && social?.state.directorySocialComplete === true)
    pending.push({
      ...social,
      kind: "caption_extract",
      cursor: 0,
      total: null,
      attempts: 0,
      state: { incremental: true },
    });
  const live = rowsOf(
    await tx.execute(
      sql`select id,kind from artist_research_jobs where artist_id=${artistId}::uuid and kind in ('social_ingest','caption_extract') and status in ('pending','running') for update`,
    ),
  ) as { id: string; kind: string }[];
  if (live.some(j => !prior.some(p => p.id === j.id)))
    throw new Error("Existing social research must finish before directory handoff");
  for (const job of prior)
    await tx.execute(
      sql`update artist_research_jobs set status='done',claimed_at=null,state=jsonb_set(state,'{directoryHandedOffToClaim}',to_jsonb(${claimId}::text)),updated_at=now() where id=${job.id}::uuid`,
    );
  if (force) return false;
  for (const job of pending) {
    const saved = { ...job.state };
    const directoryActivityId = saved.directoryActivityId;
    delete saved.directoryActivityId;
    delete saved.directoryHandedOffToClaim;
    const state = {
      ...saved,
      originalDirectoryActivityId: directoryActivityId,
      resumedFromDirectoryJobId: job.id,
      claimId,
      ...(job.kind === "social_ingest" &&
      job.status === "running" &&
      !saved.apifyRunId &&
      !saved.instagramFinished
        ? { instagramStartRequested: true }
        : {}),
    };
    const inserted = rowsOf(
      await tx.execute(sql`insert into artist_research_jobs(artist_id,kind,status,cursor,total,attempts,state,activity_id)
      values(${artistId}::uuid,${job.kind},${job.status === "failed" ? "failed" : "pending"},${job.cursor},${job.total},${job.attempts},${JSON.stringify(state)}::jsonb,${activityId}::uuid) on conflict do nothing returning id`),
    );
    if (!inserted.length) throw new Error("Directory social handoff lost its insertion race");
  }
  return true;
}

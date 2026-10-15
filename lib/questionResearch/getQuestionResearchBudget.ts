import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import {
  QUESTION_RESEARCH_DAILY_ARTIST,
  QUESTION_RESEARCH_DAILY_GLOBAL,
  SAVED_EVIDENCE_DAILY_GLOBAL,
  type ResearchQuota,
} from "./types";

/** Read rolling admission boundaries; callers hold the global lock before reserving capacity. */
export async function getQuestionResearchBudget(
  store: Pick<TransactionDb, "execute">,
  artistId: string,
) {
  const [row] = await store.execute<{
    checked_at: string;
    saved_global: number;
    outside_global: number;
    outside_artist: number;
    saved_reset: string | null;
    global_reset: string | null;
    artist_reset: string | null;
  }>(sql`with admissions as (
    select artist_id,
      case when state->>'budgetVersion'='2' or state->'savedOnly'='true'::jsonb then created_at end as saved_at,
      case when state->>'budgetVersion'='2' then (state->>'outsideReservedAt')::timestamptz
        when state->>'budgetVersion' is null and state->'savedOnly' is distinct from 'true'::jsonb then created_at end as outside_at
    from artist_research_jobs where kind='question_research'
  ) select now()::text as checked_at,
    count(*) filter(where saved_at>now()-interval '24 hours')::int as saved_global,
    count(*) filter(where outside_at>now()-interval '24 hours')::int as outside_global,
    count(*) filter(where outside_at>now()-interval '24 hours' and artist_id=${artistId}::uuid)::int as outside_artist,
    ((array_agg(saved_at order by saved_at desc) filter(where saved_at>now()-interval '24 hours'))[${SAVED_EVIDENCE_DAILY_GLOBAL}]+interval '24 hours')::text as saved_reset,
    ((array_agg(outside_at order by outside_at desc) filter(where outside_at>now()-interval '24 hours'))[${QUESTION_RESEARCH_DAILY_GLOBAL}]+interval '24 hours')::text as global_reset,
    ((array_agg(outside_at order by outside_at desc) filter(where outside_at>now()-interval '24 hours' and artist_id=${artistId}::uuid))[${QUESTION_RESEARCH_DAILY_ARTIST}]+interval '24 hours')::text as artist_reset
    from admissions`);
  if (
    !row ||
    typeof row.checked_at !== "string" ||
    !Number.isFinite(Date.parse(row.checked_at)) ||
    ![row.saved_global, row.outside_global, row.outside_artist].every(
      n => Number.isInteger(Number(n)) && Number(n) >= 0,
    )
  )
    throw new Error("Research budget unavailable");
  const checkedAt = new Date(row.checked_at).toISOString();
  const quota = (
    count: number,
    limit: number,
    reset: string | null,
    quotaScope: ResearchQuota["quotaScope"],
  ): ResearchQuota | null => {
    if (Number(count) < limit) return null;
    if (
      !reset ||
      !Number.isFinite(Date.parse(reset)) ||
      Date.parse(reset) <= Date.parse(checkedAt) ||
      Date.parse(reset) - Date.parse(checkedAt) > 86400000
    )
      throw new Error("Research budget unavailable");
    return {
      quotaScope,
      resetAt: new Date(reset).toISOString(),
      retryAfterSeconds: Math.ceil((Date.parse(reset) - Date.parse(checkedAt)) / 1000),
    };
  };
  const outside =
    [
      quota(row.outside_global, QUESTION_RESEARCH_DAILY_GLOBAL, row.global_reset, "outside_global"),
      quota(row.outside_artist, QUESTION_RESEARCH_DAILY_ARTIST, row.artist_reset, "outside_artist"),
    ]
      .filter((q): q is ResearchQuota => q !== null)
      .sort((a, b) => Date.parse(b.resetAt) - Date.parse(a.resetAt))[0] ?? null;
  return {
    checkedAt,
    saved: quota(row.saved_global, SAVED_EVIDENCE_DAILY_GLOBAL, row.saved_reset, "saved_global"),
    outside,
  };
}

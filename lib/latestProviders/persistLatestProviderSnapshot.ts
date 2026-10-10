import { sql } from "drizzle-orm";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import type { ResearchJob } from "@/lib/research/types";
import { latestProviderAccount } from "./latestProviderAccount";
import type { LatestProvider, LatestProviderItem } from "./types";
/** Replace one successful public snapshot atomically. Failures retain last good data only for the same account. */
export async function persistLatestProviderSnapshot(
  job: ResearchJob,
  provider: LatestProvider,
  accountId: string,
  items: LatestProviderItem[] | null,
): Promise<boolean> {
  if (items && (items.length > 50 || Buffer.byteLength(JSON.stringify(items)) > 400000))
    throw new Error("Latest snapshot exceeds budget");
  return withResearchJobWrite(job.artistId, job.id, async tx => {
    const [artist] = await tx.execute<{
      spotify: string | null;
      deezer: string | null;
      inprocess: string | null;
    }>(sql`select spotify,deezer,inprocess from artists where id=${job.artistId}::uuid`);
    const live = await tx.execute(
      sql`select id from artist_research_jobs where id=${job.id}::uuid and artist_id=${job.artistId}::uuid and status='running' and updated_at is not distinct from ${job.updatedAt}::timestamptz for update`,
    );
    if (!live.length) return false;
    if (!artist || latestProviderAccount(provider, artist[provider]) !== accountId)
      throw new OwnershipChangedError();
    if (items !== null)
      await tx.execute(
        sql`insert into artist_latest_provider_snapshots(artist_id,provider,account_id,items,checked_at,last_attempt_at,status) values(${job.artistId}::uuid,${provider},${accountId},${JSON.stringify(items)}::jsonb,now(),now(),'checked') on conflict(artist_id,provider) do update set account_id=excluded.account_id,items=excluded.items,checked_at=excluded.checked_at,last_attempt_at=excluded.last_attempt_at,status='checked'`,
      );
    else
      await tx.execute(
        sql`insert into artist_latest_provider_snapshots(artist_id,provider,account_id,items,checked_at,last_attempt_at,status) values(${job.artistId}::uuid,${provider},${accountId},'[]'::jsonb,null,now(),'failed') on conflict(artist_id,provider) do update set account_id=excluded.account_id,items=case when artist_latest_provider_snapshots.account_id=excluded.account_id then artist_latest_provider_snapshots.items else '[]'::jsonb end,checked_at=case when artist_latest_provider_snapshots.account_id=excluded.account_id then artist_latest_provider_snapshots.checked_at else null end,last_attempt_at=excluded.last_attempt_at,status='failed'`,
      );
    return true;
  });
}

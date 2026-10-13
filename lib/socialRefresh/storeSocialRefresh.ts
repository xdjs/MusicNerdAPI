import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import type { RefreshPlatform, SocialScan } from "./types";
/** Called in the same guarded transaction as the final stored batch; failures never advance coverage. */
export async function storeSocialRefresh(
  writer: WriteDb,
  input: {
    artistId: string;
    platform: RefreshPlatform;
    handle: string;
    scan: SocialScan;
    runId: string;
    itemCount: number;
    limit: number;
    allMapped: boolean;
  },
): Promise<void> {
  const { artistId, platform, handle, scan, runId, itemCount, limit, allMapped } = input;
  const complete = allMapped && !scan.providerLimited && itemCount < limit;
  await writer.execute(sql`insert into artist_social_refreshes(artist_id,platform,account_handle,scope,covered_through,checked_at,scan_started_at,status,item_count,run_id)
 values(${artistId}::uuid,${platform},${normalizeHandle(handle)},${scan.scope ?? "profile"},${complete ? scan.startedAt : null}::timestamptz,now(),${scan.startedAt}::timestamptz,${complete ? "complete" : "limited"},${itemCount},${runId})
 on conflict(artist_id,platform,account_handle,scope) do update set
 covered_through=case when excluded.covered_through is null then artist_social_refreshes.covered_through else greatest(artist_social_refreshes.covered_through,excluded.covered_through) end,
 checked_at=excluded.checked_at,scan_started_at=excluded.scan_started_at,status=excluded.status,item_count=excluded.item_count,run_id=excluded.run_id
 where artist_social_refreshes.scan_started_at<=excluded.scan_started_at`);
}

import { rowsOf } from "@/lib/db/rowsOf";
import { parseScanReference } from "./parseScanReference";
import { assessSocialScan } from "./assessSocialScan";
import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import type { RefreshPlatform, SocialScan, ScanPost } from "./types";
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
    payloadRecognized?: boolean;
    posts: ScanPost[];
  },
): Promise<void> {
  const { artistId, platform, handle, scan, runId, itemCount, allMapped } = input;
  // A response we could not interpret is a collection failure, not a recent
  // successful account check. Throw inside the caller's guarded transaction
  // so partial post writes roll back and the saved paid dataset can be retried.
  if (!(input.payloadRecognized ?? allMapped)) throw new Error("Unrecognized account scan results");
  // Reconcile against the currently stored reference under the artist/job write lock.
  // Another account job may have completed since this run saved its immutable input.
  const current = rowsOf(
    await writer.execute(
      sql`select scan_reference from artist_social_refreshes where artist_id=${artistId}::uuid and platform=${platform} and account_handle=${normalizeHandle(handle)} and scope=${scan.scope ?? "profile"} for update`,
    ),
  )[0] as { scan_reference?: unknown } | undefined;
  const reference = parseScanReference(current?.scan_reference);
  if (current?.scan_reference && JSON.stringify(current.scan_reference) !== "{}" && !reference)
    throw new Error("Invalid saved social scan reference");
  const assessment = assessSocialScan(
    reference?.anchors.length ? { ...scan, reference } : scan,
    input.posts,
    allMapped,
  );
  const complete = assessment.connected;
  await writer.execute(sql`insert into artist_social_refreshes(artist_id,platform,account_handle,scope,covered_through,checked_at,scan_started_at,status,item_count,run_id,scan_reference)
 values(${artistId}::uuid,${platform},${normalizeHandle(handle)},${scan.scope ?? "profile"},${complete ? scan.startedAt : null}::timestamptz,now(),${scan.startedAt}::timestamptz,${complete ? "complete" : "limited"},${itemCount},${runId},${JSON.stringify(assessment.reference)}::jsonb)
 on conflict(artist_id,platform,account_handle,scope) do update set
 covered_through=case when excluded.covered_through is null then artist_social_refreshes.covered_through else greatest(artist_social_refreshes.covered_through,excluded.covered_through) end,
 checked_at=excluded.checked_at,scan_started_at=excluded.scan_started_at,status=excluded.status,item_count=excluded.item_count,run_id=excluded.run_id,scan_reference=excluded.scan_reference
 where artist_social_refreshes.scan_started_at<=excluded.scan_started_at`);
}

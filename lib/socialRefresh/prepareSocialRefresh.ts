import { sql } from "drizzle-orm";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";
import { readSocialRefresh } from "./readSocialRefresh";
import type { RefreshPlatform, SocialScan } from "./types";

/** Reserve the sole bounded gap retry under the same lock as revocation and collection. */
export async function prepareSocialRefresh(
  job: { id: string; artistId: string },
  platform: RefreshPlatform,
  handle: string,
  lookbackDays?: number,
): Promise<SocialScan> {
  return withResearchJobWrite(job.artistId, job.id, async writer => {
    const scan = await readSocialRefresh(job.artistId, platform, handle, lookbackDays, writer);
    if (!scan.skip && scan.reference?.gapSince) {
      scan.reference = { ...scan.reference, recoveryAttemptedAt: scan.startedAt };
      await writer.execute(sql`update artist_social_refreshes set scan_reference=${JSON.stringify(scan.reference)}::jsonb
        where artist_id=${job.artistId}::uuid and platform=${platform}
        and account_handle=${normalizeHandle(handle)} and scope=${scan.scope ?? "profile"}`);
    }
    return scan;
  });
}

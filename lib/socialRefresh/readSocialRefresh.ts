import { sql } from "drizzle-orm";
import { db, type WriteDb } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { planSocialRefresh } from "./planSocialRefresh";
import type { RefreshPlatform, SocialScan } from "./types";
/** Private durable checkpoint; failure must not fall back to another paid profile scrape. */
export async function readSocialRefresh(
  artistId: string,
  platform: RefreshPlatform,
  handle: string,
  lookbackDays?: number,
  reader: WriteDb = db,
): Promise<SocialScan> {
  const scope = lookbackDays === 30 ? "latest" : "profile";
  const rows = rowsOf(
    await reader.execute(
      sql`select covered_through::text as "coveredThrough", checked_at::text as "checkedAt" from artist_social_refreshes where artist_id=${artistId}::uuid and platform=${platform} and account_handle=${normalizeHandle(handle)} and scope=${scope}`,
    ),
  );
  const row = rows[0] as { coveredThrough: string | null; checkedAt: string } | undefined;
  return { ...planSocialRefresh(row ?? null, new Date(), lookbackDays), scope };
}

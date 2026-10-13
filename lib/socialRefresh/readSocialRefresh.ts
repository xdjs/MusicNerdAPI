import { parseScanReference } from "./parseScanReference";
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
      sql`select covered_through::text as "coveredThrough", checked_at::text as "checkedAt", scan_reference as "reference" from artist_social_refreshes where artist_id=${artistId}::uuid and platform=${platform} and account_handle=${normalizeHandle(handle)} and scope=${scope}`,
    ),
  );
  const row = rows[0] as
    { coveredThrough: string | null; reference?: unknown; checkedAt: string } | undefined;
  const reference = parseScanReference(row?.reference);
  if (row?.reference && JSON.stringify(row.reference) !== "{}" && !reference)
    throw new Error("Invalid saved social scan reference");
  return {
    ...planSocialRefresh(row ? { ...row, reference } : null, new Date(), lookbackDays),
    scope,
  };
}

import { sql } from "drizzle-orm";
import { claimColumns } from "@/lib/claims/claimColumns";
import type { ClaimRow } from "@/lib/claims/types";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Approves or rejects a claim, whatever its current status, as MusicNerdWeb did.
 *
 * @param claimId - The claim.
 * @param status - The new status.
 * @returns The updated claim, or undefined when there is none; throws on a database error.
 */
export async function setClaimStatus(
  claimId: string,
  status: "approved" | "rejected",
): Promise<ClaimRow | undefined> {
  const [claim] = rowsOf(
    await db.execute(sql`update artist_claims
      set status = ${status}, updated_at = (now() AT TIME ZONE 'utc'::text)
      where id = ${claimId}::uuid
      returning ${claimColumns}`),
  ) as ClaimRow[];
  return claim;
}

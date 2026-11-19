import { sql } from "drizzle-orm";
import { claimColumns } from "@/lib/claims/claimColumns";
import type { ClaimRow } from "@/lib/claims/types";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * One claim, whatever its status.
 *
 * @param claimId - The claim.
 * @returns The claim, or undefined when there is none; throws on a database error.
 */
export async function getClaimById(claimId: string): Promise<ClaimRow | undefined> {
  const [claim] = rowsOf(
    await db.execute(sql`select ${claimColumns} from artist_claims where id = ${claimId}::uuid`),
  ) as ClaimRow[];
  return claim;
}

import { sql } from "drizzle-orm";
import type { db } from "@/lib/db/db";

/**
 * Re-points bio corrections the placeholder account filed or reviewed at the
 * surviving account. Called inside the account merge, after the account locks
 * and before the placeholder is deleted.
 *
 * @param tx - The open transaction.
 * @param fromUserId - The placeholder account being merged away.
 * @param toUserId - The surviving account.
 * @returns Nothing.
 */
export async function transferBioCorrections(
  tx: Pick<typeof db, "execute">,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await tx.execute(sql`update artist_bio_corrections set
    user_id=case when user_id=${fromUserId}::uuid then ${toUserId}::uuid else user_id end,
    reviewed_by=case when reviewed_by=${fromUserId}::uuid then ${toUserId}::uuid else reviewed_by end
    where user_id=${fromUserId}::uuid or reviewed_by=${fromUserId}::uuid`);
}

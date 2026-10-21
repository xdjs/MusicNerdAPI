import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";

/**
 * How many links a user has submitted, or how many of them an admin approved.
 * MusicNerdWeb's `/api/ugcCount` and `/api/approvedUGCCount` fetched every row
 * and took its length; this counts in the database, same number.
 *
 * @param userId - The authenticated user; never from the request.
 * @param approvedOnly - Count only `accepted = true` submissions.
 * @returns The count.
 */
export async function countUserUgc(userId: string, approvedOnly: boolean): Promise<number> {
  const where = approvedOnly
    ? and(eq(ugcresearch.userId, userId), eq(ugcresearch.accepted, true))
    : eq(ugcresearch.userId, userId);
  const [{ value }] = await db.select({ value: count() }).from(ugcresearch).where(where);
  return value;
}

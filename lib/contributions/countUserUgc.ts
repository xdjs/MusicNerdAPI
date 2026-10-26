import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { ugcresearch } from "@/lib/db/schema";

/**
 * How many links a user has submitted, whatever their review state.
 * MusicNerdWeb's `/api/ugcCount` fetched every row and took its length; this
 * counts in the database, same number.
 *
 * @param userId - The authenticated user; never from the request.
 * @returns The count.
 */
export async function countUserUgc(userId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(ugcresearch)
    .where(eq(ugcresearch.userId, userId));
  return value;
}

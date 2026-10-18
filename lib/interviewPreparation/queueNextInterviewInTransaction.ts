import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { queueInterviewPreparationInTransaction } from "./queueInterviewPreparationInTransaction";
/** Called once by explicit answered Finish under the artist lock; never from a read or worker. */
export async function queueNextInterviewInTransaction(
  tx: TransactionDb,
  artistId: string,
  userId: string,
  finishedSessionId: string,
  finishedSitting: number,
) {
  const [claim] = await tx.execute<{ user_id: string }>(
    sql`select user_id from artist_claims where artist_id=${artistId}::uuid and status='approved' limit 1`,
  );
  // Admin finishing somebody else's sitting does not opt its artist into preparation.
  if (claim?.user_id !== userId) return;
  const [existing] = await tx.execute<{ id: string }>(
    sql`select id from artist_interview_sessions where artist_id=${artistId}::uuid and (state='active' or request_id=${finishedSessionId}::uuid) limit 1`,
  );
  if (existing) return;
  const [next] = await tx.execute<{ id: string }>(
    sql`insert into artist_interview_sessions(artist_id,request_id,sitting,created_by) values(${artistId}::uuid,${finishedSessionId}::uuid,${finishedSitting + 1},${userId}::uuid) returning id`,
  );
  if (!next) throw new Error("Private next interview unavailable");
  await queueInterviewPreparationInTransaction(tx, artistId, userId, next.id);
}

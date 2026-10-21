import { sql } from "drizzle-orm";
import type { HeartbeatBody } from "@/lib/agentReports/types";
import { db } from "@/lib/db/db";
import { agentHeartbeats } from "@/lib/db/schema";

/**
 * Writes a worker's heartbeat: one row per `worker_id`, every reported field
 * replacing the previous value (an omitted one becomes null) and `updated_at`
 * moving to now; `started_at` is set once, on the first heartbeat. Same
 * statement as MusicNerdWeb's `upsertHeartbeat`, written with the typed schema.
 *
 * @param params - The heartbeat and the reporting key's hash.
 * @returns Once the row is written.
 */
export async function upsertHeartbeat(
  params: HeartbeatBody & { apiKeyHash: string },
): Promise<void> {
  const { workerId, apiKeyHash, status, currentRun, batchPlatform, batchSize, message, config } =
    params;
  await db
    .insert(agentHeartbeats)
    .values({
      workerId,
      apiKeyHash,
      status,
      currentRun: currentRun ?? null,
      batchPlatform: batchPlatform ?? null,
      batchSize: batchSize ?? null,
      message: message ?? null,
      config: config ?? null,
      startedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: agentHeartbeats.workerId,
      set: {
        apiKeyHash: sql`excluded.api_key_hash`,
        status: sql`excluded.status`,
        currentRun: sql`excluded.current_run`,
        batchPlatform: sql`excluded.batch_platform`,
        batchSize: sql`excluded.batch_size`,
        message: sql`excluded.message`,
        config: sql`excluded.config`,
        updatedAt: sql`now()`,
      },
    });
}

import { sql } from "drizzle-orm";
import type { HeartbeatBody } from "@/lib/agentReports/types";
import { db } from "@/lib/db/db";

/**
 * Writes a worker's heartbeat: one row per `worker_id`, every reported field
 * replacing the previous value and `updated_at` moving to now. The SQL is
 * MusicNerdWeb's `upsertHeartbeat`, unchanged.
 *
 * @param params - The heartbeat and the reporting key's hash.
 * @returns Once the row is written.
 */
export async function upsertHeartbeat(
  params: HeartbeatBody & { apiKeyHash: string },
): Promise<void> {
  const { workerId, apiKeyHash, status, currentRun, batchPlatform, batchSize, message, config } =
    params;
  await db.execute(sql`
    INSERT INTO agent_heartbeats (worker_id, api_key_hash, status, current_run, batch_platform, batch_size, message, config, started_at, updated_at)
    VALUES (${workerId}, ${apiKeyHash}, ${status}, ${currentRun ?? null}, ${batchPlatform ?? null}, ${batchSize ?? null}, ${message ?? null}, ${config ? JSON.stringify(config) : null}::jsonb, now(), now())
    ON CONFLICT (worker_id) DO UPDATE SET
      api_key_hash = EXCLUDED.api_key_hash,
      status = EXCLUDED.status,
      current_run = EXCLUDED.current_run,
      batch_platform = EXCLUDED.batch_platform,
      batch_size = EXCLUDED.batch_size,
      message = EXCLUDED.message,
      config = EXCLUDED.config,
      updated_at = now()
  `);
}

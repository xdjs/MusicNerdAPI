import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

/**
 * Upsert an agent worker heartbeat into the `agent_heartbeats` table.
 *
 * @param params - The heartbeat fields from the agent.
 */
export async function upsertHeartbeat(params: {
  workerId: string;
  apiKeyHash: string;
  status: string;
  currentRun?: number;
  batchPlatform?: string;
  batchSize?: number;
  message?: string;
  config?: Record<string, unknown>;
}): Promise<void> {
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

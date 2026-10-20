import { sql } from "drizzle-orm";
import type { WorkerHeartbeat } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Every agent worker's last heartbeat, newest first. A worker that hasn't beaten
 * within its batch timeout plus two minutes is `dead`.
 *
 * @returns The workers with their computed status.
 */
export async function getActiveWorkers(): Promise<WorkerHeartbeat[]> {
  const rows = await db.execute<{
    worker_id: string;
    api_key_hash: string;
    status: string;
    computed_status: WorkerHeartbeat["computedStatus"];
    current_run: number | null;
    batch_platform: string | null;
    batch_size: number | null;
    message: string | null;
    started_at: string;
    updated_at: string;
    config: Record<string, unknown> | null;
  }>(sql`
    select *,
      case
        when status = 'error' then 'error'
        when status = 'stopping' then 'stopped'
        when updated_at < now() - make_interval(secs =>
          coalesce((config->>'batchTimeout')::int, 900) + 120) then 'dead'
        when status = 'idle' then 'idle'
        else 'running'
      end as computed_status
    from agent_heartbeats order by updated_at desc`);
  return [...rows].map(r => ({
    workerId: r.worker_id,
    apiKeyHash: r.api_key_hash,
    status: r.status,
    computedStatus: r.computed_status,
    currentRun: r.current_run,
    batchPlatform: r.batch_platform,
    batchSize: r.batch_size,
    message: r.message,
    startedAt: r.started_at,
    updatedAt: r.updated_at,
    config: r.config,
  }));
}

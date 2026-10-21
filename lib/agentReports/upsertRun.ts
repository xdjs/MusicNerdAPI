import { sql } from "drizzle-orm";
import type { RunReportBody } from "@/lib/agentReports/types";
import { db } from "@/lib/db/db";

/**
 * Writes one run, keyed by `worker_id` and `run_number`. On a repeat report
 * the status and counts replace the stored values; timings, batch size, exit
 * code and failure fields only replace them when sent (COALESCE), so a run
 * reported as running can be finished later. The SQL is MusicNerdWeb's
 * `upsertRun`, unchanged: `platform` defaults to deezer, counts to 0.
 *
 * @param p - The run report and the reporting key's hash.
 * @returns Once the row is written.
 */
export async function upsertRun(p: RunReportBody & { apiKeyHash: string }): Promise<void> {
  await db.execute(sql`
    INSERT INTO agent_runs (
      worker_id, api_key_hash, run_number, platform, status, started_at,
      ended_at, wall_time_secs, claude_time_secs, api_time_secs, turns,
      batch_size, resolved, excluded, skipped, errors,
      high_confidence, medium_confidence, conflicts, name_mismatches, too_ambiguous,
      exit_code, fail_category, fail_reason
    ) VALUES (
      ${p.workerId}, ${p.apiKeyHash}, ${p.runNumber}, ${p.platform ?? "deezer"}, ${p.status}, ${p.startedAt},
      ${p.endedAt ?? null}, ${p.wallTimeSecs ?? null}, ${p.claudeTimeSecs ?? null}, ${p.apiTimeSecs ?? null}, ${p.turns ?? null},
      ${p.batchSize ?? null}, ${p.resolved ?? 0}, ${p.excluded ?? 0}, ${p.skipped ?? 0}, ${p.errors ?? 0},
      ${p.highConfidence ?? 0}, ${p.mediumConfidence ?? 0}, ${p.conflicts ?? 0}, ${p.nameMismatches ?? 0}, ${p.tooAmbiguous ?? 0},
      ${p.exitCode ?? null}, ${p.failCategory ?? null}, ${p.failReason ?? null}
    )
    ON CONFLICT (worker_id, run_number) DO UPDATE SET
      status = EXCLUDED.status,
      ended_at = COALESCE(EXCLUDED.ended_at, agent_runs.ended_at),
      wall_time_secs = COALESCE(EXCLUDED.wall_time_secs, agent_runs.wall_time_secs),
      claude_time_secs = COALESCE(EXCLUDED.claude_time_secs, agent_runs.claude_time_secs),
      api_time_secs = COALESCE(EXCLUDED.api_time_secs, agent_runs.api_time_secs),
      turns = COALESCE(EXCLUDED.turns, agent_runs.turns),
      batch_size = COALESCE(EXCLUDED.batch_size, agent_runs.batch_size),
      resolved = EXCLUDED.resolved,
      excluded = EXCLUDED.excluded,
      skipped = EXCLUDED.skipped,
      errors = EXCLUDED.errors,
      high_confidence = EXCLUDED.high_confidence,
      medium_confidence = EXCLUDED.medium_confidence,
      conflicts = EXCLUDED.conflicts,
      name_mismatches = EXCLUDED.name_mismatches,
      too_ambiguous = EXCLUDED.too_ambiguous,
      exit_code = COALESCE(EXCLUDED.exit_code, agent_runs.exit_code),
      fail_category = COALESCE(EXCLUDED.fail_category, agent_runs.fail_category),
      fail_reason = COALESCE(EXCLUDED.fail_reason, agent_runs.fail_reason)
  `);
}

import { sql } from "drizzle-orm";
import type { AgentRun } from "@/lib/agentWork/types";
import { db } from "@/lib/db/db";

/**
 * Agent worker runs, newest first.
 *
 * @param limit - Rows to return.
 * @param offset - Rows to skip.
 * @returns The runs and the total run count.
 */
export async function getRunHistory(
  limit = 50,
  offset = 0,
): Promise<{ runs: AgentRun[]; total: number }> {
  const [countRows, rows] = await Promise.all([
    db.execute<{ total: number }>(sql`select count(*)::int as total from agent_runs`),
    db.execute<{
      worker_id: string;
      run_number: number;
      platform: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      wall_time_secs: number | null;
      claude_time_secs: number | null;
      api_time_secs: number | null;
      turns: number | null;
      batch_size: number | null;
      resolved: number;
      excluded: number;
      skipped: number;
      errors: number;
      high_confidence: number;
      medium_confidence: number;
      conflicts: number;
      name_mismatches: number;
      too_ambiguous: number;
      exit_code: number | null;
      fail_category: string | null;
      fail_reason: string | null;
    }>(sql`select worker_id, run_number, platform, status, started_at, ended_at,
        wall_time_secs, claude_time_secs, api_time_secs, turns, batch_size,
        resolved, excluded, skipped, errors, high_confidence, medium_confidence,
        conflicts, name_mismatches, too_ambiguous, exit_code, fail_category, fail_reason
      from agent_runs order by started_at desc limit ${limit} offset ${offset}`),
  ]);
  return {
    total: countRows[0]?.total ?? 0,
    runs: [...rows].map(r => ({
      workerId: r.worker_id,
      runNumber: r.run_number,
      platform: r.platform,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      wallTimeSecs: r.wall_time_secs,
      claudeTimeSecs: r.claude_time_secs,
      apiTimeSecs: r.api_time_secs,
      turns: r.turns,
      batchSize: r.batch_size,
      resolved: r.resolved,
      excluded: r.excluded,
      skipped: r.skipped,
      errors: r.errors,
      highConfidence: r.high_confidence,
      mediumConfidence: r.medium_confidence,
      conflicts: r.conflicts,
      nameMismatches: r.name_mismatches,
      tooAmbiguous: r.too_ambiguous,
      exitCode: r.exit_code,
      failCategory: r.fail_category,
      failReason: r.fail_reason,
    })),
  };
}

import { sql } from "drizzle-orm";
import type { RunReportBody } from "@/lib/agentReports/types";
import { db } from "@/lib/db/db";
import { agentRuns } from "@/lib/db/schema";

/** `column = COALESCE(EXCLUDED.column, agent_runs.column)`: keep the stored value when the report omits it. */
const keepUnlessSent = (column: string) =>
  sql.raw(`COALESCE(excluded.${column}, agent_runs.${column})`);
/** `column = EXCLUDED.column`: the report's value, always. */
const replace = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Writes one run, keyed by `worker_id` and `run_number`. On a repeat report
 * the status and counts replace the stored values; timings, batch size, exit
 * code and failure fields only replace them when sent (COALESCE), so a run
 * reported as running can be finished later. Same statement as MusicNerdWeb's
 * `upsertRun`, written with the typed schema: `platform` defaults to deezer,
 * counts to 0.
 *
 * @param p - The run report and the reporting key's hash.
 * @returns Once the row is written.
 */
export async function upsertRun(p: RunReportBody & { apiKeyHash: string }): Promise<void> {
  await db
    .insert(agentRuns)
    .values({
      workerId: p.workerId,
      apiKeyHash: p.apiKeyHash,
      runNumber: p.runNumber,
      platform: p.platform ?? "deezer",
      status: p.status,
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? null,
      wallTimeSecs: p.wallTimeSecs ?? null,
      claudeTimeSecs: p.claudeTimeSecs ?? null,
      apiTimeSecs: p.apiTimeSecs ?? null,
      turns: p.turns ?? null,
      batchSize: p.batchSize ?? null,
      resolved: p.resolved ?? 0,
      excluded: p.excluded ?? 0,
      skipped: p.skipped ?? 0,
      errors: p.errors ?? 0,
      highConfidence: p.highConfidence ?? 0,
      mediumConfidence: p.mediumConfidence ?? 0,
      conflicts: p.conflicts ?? 0,
      nameMismatches: p.nameMismatches ?? 0,
      tooAmbiguous: p.tooAmbiguous ?? 0,
      exitCode: p.exitCode ?? null,
      failCategory: p.failCategory ?? null,
      failReason: p.failReason ?? null,
    })
    .onConflictDoUpdate({
      target: [agentRuns.workerId, agentRuns.runNumber],
      set: {
        status: replace("status"),
        endedAt: keepUnlessSent("ended_at"),
        wallTimeSecs: keepUnlessSent("wall_time_secs"),
        claudeTimeSecs: keepUnlessSent("claude_time_secs"),
        apiTimeSecs: keepUnlessSent("api_time_secs"),
        turns: keepUnlessSent("turns"),
        batchSize: keepUnlessSent("batch_size"),
        resolved: replace("resolved"),
        excluded: replace("excluded"),
        skipped: replace("skipped"),
        errors: replace("errors"),
        highConfidence: replace("high_confidence"),
        mediumConfidence: replace("medium_confidence"),
        conflicts: replace("conflicts"),
        nameMismatches: replace("name_mismatches"),
        tooAmbiguous: replace("too_ambiguous"),
        exitCode: keepUnlessSent("exit_code"),
        failCategory: keepUnlessSent("fail_category"),
        failReason: keepUnlessSent("fail_reason"),
      },
    });
}

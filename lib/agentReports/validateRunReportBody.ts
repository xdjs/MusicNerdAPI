import { NextResponse } from "next/server";
import { z } from "zod";
import { RUN_STATUSES } from "@/lib/agentReports/const";
import type { RunReportBody } from "@/lib/agentReports/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const statusMessage = `status must be one of: ${RUN_STATUSES.join(", ")}`;
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const schema = z.object({
  workerId: z.string({ error: "workerId is required" }).min(1, { error: "workerId is required" }),
  runNumber: z
    .number({ error: "runNumber must be a positive integer" })
    .int({ error: "runNumber must be a positive integer" })
    .min(1, { error: "runNumber must be a positive integer" }),
  status: z.enum(RUN_STATUSES, { error: statusMessage }),
  startedAt: z
    .string({ error: "startedAt is required (ISO timestamp)" })
    .min(1, { error: "startedAt is required (ISO timestamp)" }),
  platform: optional(z.string()),
  endedAt: optional(z.string()),
  wallTimeSecs: optional(z.number()),
  claudeTimeSecs: optional(z.number()),
  apiTimeSecs: optional(z.number()),
  turns: optional(z.number()),
  batchSize: optional(z.number()),
  resolved: optional(z.number()),
  excluded: optional(z.number()),
  skipped: optional(z.number()),
  errors: optional(z.number()),
  highConfidence: optional(z.number()),
  mediumConfidence: optional(z.number()),
  conflicts: optional(z.number()),
  nameMismatches: optional(z.number()),
  tooAmbiguous: optional(z.number()),
  exitCode: optional(z.number()),
  failCategory: optional(z.string()),
  failReason: optional(z.string()),
});

/**
 * Validates a run report as MusicNerdWeb did: `workerId`, a positive integer
 * `runNumber`, a known `status` and `startedAt` are required; an optional
 * field of the wrong type is dropped, not refused.
 *
 * @param body - The parsed JSON body.
 * @returns The run report, or a 400 `{ error }` response.
 */
export function validateRunReportBody(body: unknown): RunReportBody | NextResponse {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400, headers: getCorsHeaders() },
    );
  return parsed.data;
}

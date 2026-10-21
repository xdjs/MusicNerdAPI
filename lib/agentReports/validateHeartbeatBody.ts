import { NextResponse } from "next/server";
import { z } from "zod";
import { HEARTBEAT_STATUSES } from "@/lib/agentReports/const";
import type { HeartbeatBody } from "@/lib/agentReports/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const statusMessage = `status must be one of: ${HEARTBEAT_STATUSES.join(", ")}`;
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const schema = z.object({
  workerId: z.string({ error: "workerId is required" }).min(1, { error: "workerId is required" }),
  status: z.enum(HEARTBEAT_STATUSES, { error: statusMessage }),
  currentRun: optional(z.number()),
  batchPlatform: optional(z.string()),
  batchSize: optional(z.number()),
  message: optional(z.string()),
  config: optional(
    z.custom<Record<string, unknown>>(value => !!value && typeof value === "object"),
  ),
});

/**
 * Validates a heartbeat as MusicNerdWeb did: `workerId` and a known `status`
 * are required; an optional field of the wrong type is dropped, not refused.
 *
 * @param body - The parsed JSON body.
 * @returns The heartbeat, or a 400 `{ error }` response.
 */
export function validateHeartbeatBody(body: unknown): HeartbeatBody | NextResponse {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400, headers: getCorsHeaders() },
    );
  return parsed.data;
}

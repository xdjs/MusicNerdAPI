import { z } from "zod";
import type { PreparationState } from "./preparationTypes";
/** Validate durable identity before trusting internal job state; candidates are checked again at consume. */
export function parsePreparationState(value: unknown): PreparationState {
  return z
    .object({
      version: z.literal(1),
      claimId: z.uuid(),
      userId: z.uuid(),
      sessionId: z.uuid(),
      sitting: z.number().int().positive(),
      ordinal: z.number().int().min(1).max(3),
      memorySnapshotId: z.string().regex(/^[a-f0-9]{64}$/),
      stage: z.enum(["preparing", "ready", "failed", "stale", "consumed"]),
      cache: z.record(z.string(), z.unknown()),
      inFlight: z.boolean(),
      createdAt: z.iso.datetime(),
      candidate: z.unknown().optional(),
      errorCode: z
        .enum([
          "preparation_failed",
          "model_output_invalid",
          "timeout_or_cancelled",
          "external_outcome_unknown",
        ])
        .optional(),
    })
    .parse(value) as PreparationState;
}

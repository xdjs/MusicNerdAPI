import { z } from "zod";
const schema = z.object({
  version: z.literal(1),
  anchor: z
    .object({
      name: z
        .string()
        .min(1)
        .max(500)
        .refine(value => Boolean(value.trim())),
      spotify: z
        .string()
        .regex(/^[A-Za-z0-9]{22}$/)
        .nullable(),
      deezer: z
        .string()
        .regex(/^[1-9]\d*$/)
        .nullable(),
    })
    .refine(a => !(a.spotify && a.deezer)),
  expiresAtMs: z.number().finite().positive(),
  nextAttemptAtMs: z.number().finite().optional(),
  outcome: z.string().optional(),
});
/** Reject malformed job snapshots before contacting any provider. */
export function parseCatalogMatchState(value: unknown) {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

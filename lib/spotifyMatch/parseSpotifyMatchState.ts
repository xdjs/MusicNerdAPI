import { z } from "zod";
import type { SpotifyMatchState } from "./types";

const schema = z
  .object({
    version: z.literal(1),
    purpose: z.literal("spotify_identity"),
    deezerId: z.string().regex(/^[1-9]\d*$/),
    artistName: z.string().min(1).max(500),
    creationActivityId: z.string().uuid(),
    directoryActivityId: z.string().uuid(),
    expiresAtMs: z.number().finite().positive(),
    nextAttemptAtMs: z.number().finite().optional(),
    phase: z.enum(["top", "deezer", "spotify"]).optional(),
    trackIds: z.array(z.string().regex(/^\d+$/)).max(5).optional(),
    trackCursor: z.number().int().min(0).max(5).optional(),
    isrcs: z
      .array(z.string().regex(/^[A-Z0-9]{12}$/))
      .max(5)
      .optional(),
    matches: z
      .array(
        z.object({
          isrc: z.string().regex(/^[A-Z0-9]{12}$/),
          artists: z
            .array(
              z.object({
                id: z.string().regex(/^[A-Za-z0-9]{22}$/),
                name: z.string().max(500),
              }),
            )
            .max(50),
          incomplete: z.boolean().optional(),
        }),
      )
      .max(5)
      .optional(),
    identityChanged: z.boolean().optional(),
    outcome: z.string().optional(),
  })
  .passthrough();

/** A queued identity job is not a general-purpose URL fetch or unbounded research request. */
export function parseSpotifyMatchState(value: unknown): SpotifyMatchState | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

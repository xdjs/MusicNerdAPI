import { NextResponse } from "next/server";
import type { MusicPlatform } from "@/lib/musicPlatform/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Validates a POST /api/artist body: a non-empty `platformId`, `platform`
 * `spotify` (the default) or `deezer`, and an optional boolean `forceCreate`.
 *
 * @param body - The parsed JSON body, or null.
 * @returns The body with defaults, or a 400 `{ status, error }`.
 */
export function validateAddArtistBody(
  body: unknown,
): { platformId: string; platform: MusicPlatform; forceCreate: boolean } | NextResponse {
  const fail = (error: string) =>
    NextResponse.json({ status: "error", error }, { status: 400, headers: getCorsHeaders() });
  const {
    platformId,
    platform = "spotify",
    forceCreate = false,
  } = (body ?? {}) as Record<string, unknown>;
  if (typeof platformId !== "string" || !platformId.trim()) return fail("platformId is required");
  if (platform !== "spotify" && platform !== "deezer")
    return fail("platform must be 'spotify' or 'deezer'");
  if (typeof forceCreate !== "boolean") return fail("forceCreate must be a boolean");
  return { platformId: platformId.trim(), platform, forceCreate };
}

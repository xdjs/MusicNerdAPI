import { HEADERS, MB, TIMEOUT_MS } from "@/lib/musicbrainz/const";
import type { MusicBrainzRequestResult } from "@/lib/musicbrainz/types";

/**
 * One MusicBrainz web-service request. Never throws.
 *
 * @param path - The path under /ws/2, with its query.
 * @param timeoutMs - How long to wait.
 * @returns The JSON object, or not-found for a 404, or unavailable for anything else.
 */
export async function requestMusicBrainz(
  path: string,
  timeoutMs: number = TIMEOUT_MS,
): Promise<MusicBrainzRequestResult> {
  try {
    const res = await fetch(`${MB}${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return res.status === 404 ? { status: "not-found" } : { status: "unavailable" };
    const data = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "unavailable" };
    return { status: "ok", data: data as Record<string, unknown> };
  } catch {
    return { status: "unavailable" };
  }
}

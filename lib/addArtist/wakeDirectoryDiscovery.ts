import { WAKE_TIMEOUT_MS } from "@/lib/addArtist/const";

/**
 * Asks this API to run the new artist's directory research now, in its own
 * invocation, rather than wait for the cron. Best effort: the job is already
 * queued, and the cron recovers it.
 *
 * @param origin - This API's origin, from the request.
 * @param artistId - The new artist.
 * @returns True when a slice ran. Never throws.
 */
export async function wakeDirectoryDiscovery(origin: string, artistId: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/api/research/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId, kinds: ["source_search"] }),
      cache: "no-store",
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { status?: unknown; ran?: unknown };
    return result?.status === "ok" && result.ran === true;
  } catch {
    return false;
  }
}

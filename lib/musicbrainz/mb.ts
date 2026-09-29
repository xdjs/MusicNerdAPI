import { TIMEOUT_MS } from "@/lib/musicbrainz/const";
import { requestMusicBrainz } from "@/lib/musicbrainz/requestMusicBrainz";

/**
 * A MusicBrainz request's data, when there is any.
 *
 * @param path - The path under /ws/2, with its query.
 * @param timeoutMs - How long to wait.
 * @returns The JSON object, or null on any failure.
 */
export async function mb(
  path: string,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Record<string, unknown> | null> {
  const result = await requestMusicBrainz(path, timeoutMs);
  return result.status === "ok" ? result.data : null;
}

import { hasSocialPosts } from "@/lib/instagram/hasSocialPosts";
import { wait } from "@/lib/musicbrainz/wait";

/**
 * Waits for a background scrape to land, polling cheaply, so a scrape that is
 * nearly done still produces grounded questions. Bounded, because the artist is waiting.
 *
 * @param artistId - The artist.
 * @param timeoutMs - How long to wait.
 * @param pollMs - How often to check.
 * @returns True as soon as any post exists; false once the timeout passes.
 */
export async function waitForSocialPosts(
  artistId: string,
  timeoutMs: number,
  pollMs = 1000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await hasSocialPosts(artistId)) return true;
    if (Date.now() >= deadline) return false;
    await wait(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }
}

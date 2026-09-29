import { RATE_LIMIT_MS } from "@/lib/musicbrainz/const";
import { wait } from "@/lib/musicbrainz/wait";

let paceQueue: Promise<void> = Promise.resolve();
let lastCallAt = 0;

/**
 * Paces every MusicBrainz call in this process to their one-a-second limit.
 * Each caller chains onto the previous one, so concurrent callers can't all
 * read the same timestamp and burst; MusicBrainz answers a throttled request
 * with an entry and no relations, which looks like an unknown artist. Pacing is
 * per instance, as in MusicNerdWeb: serverless instances don't share it.
 *
 * @param deadline - Give up instead of waiting past this (epoch ms).
 * @returns True once this caller may make its request; false if the deadline came first.
 */
export async function sinceLastCall(deadline: number = Number.POSITIVE_INFINITY): Promise<boolean> {
  let reserved = false;
  let cancelled = false;
  const mine: Promise<void> = paceQueue.then(async () => {
    if (cancelled) return;
    const delay = Math.max(0, lastCallAt + RATE_LIMIT_MS - Date.now());
    if (Date.now() + delay >= deadline) return;
    if (delay > 0) await wait(delay);
    if (cancelled || Date.now() >= deadline) return;
    lastCallAt = Date.now();
    reserved = true;
  });
  // One failure must not poison the queue for everyone after it.
  paceQueue = mine.then(
    () => undefined,
    () => undefined,
  );

  if (!Number.isFinite(deadline)) {
    await mine;
    return reserved;
  }
  const remaining = Math.max(0, deadline - Date.now());
  if (remaining === 0) {
    cancelled = true;
    return false;
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadlineReached = new Promise<boolean>(resolve => {
    timeoutId = setTimeout(() => {
      cancelled = true;
      resolve(false);
    }, remaining);
  });
  const result = await Promise.race([mine.then(() => reserved), deadlineReached]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

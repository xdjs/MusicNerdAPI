/**
 * Races a promise against a deadline. The loser keeps running, as in MusicNerdWeb.
 *
 * @param promise - The work.
 * @param ms - The deadline.
 * @param message - The rejection's message; callers match on it (a caption batch retries on "timed out").
 * @returns The work's result, or a rejection with `message` once `ms` passes.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

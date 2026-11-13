/** The longest the suite waits for a staging allowance to reopen: one hourly window plus margin. */
export const MAX_ALLOWANCE_WAIT_MS = 61 * 60 * 1000;

type Waitable = { error?: string; retryAfterSeconds?: number };

/**
 * Runs one chat turn and, when it hit the staging question allowance (30 per rolling hour
 * per visitor key, 200 per day overall), waits for the reset the response reported and
 * tries once more. The allowance itself is untouched: the suite is patient, not exempt. A
 * reset further away than `maxWaitMs` (the daily allowance) is returned as the error it is.
 *
 * @param attempt - Sends the question and returns the turn.
 * @param options - `sleep` and `log` are injection points for tests.
 * @returns The first turn that is not an allowance error, or the second attempt's turn.
 */
export async function withAllowanceWait<T extends Waitable>(
  attempt: () => Promise<T>,
  options: {
    maxWaitMs?: number;
    sleep?: (ms: number) => Promise<void>;
    log?: (line: string) => void;
  } = {},
): Promise<T> {
  const {
    maxWaitMs = MAX_ALLOWANCE_WAIT_MS,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    log = console.log,
  } = options;
  const first = await attempt();
  if (!first.error || first.retryAfterSeconds === undefined) return first;
  // Two seconds past the reported reset covers clock skew between the database and the runner.
  const waitMs = first.retryAfterSeconds * 1000 + 2000;
  if (waitMs > maxWaitMs) return first;
  log(`[chat] staging allowance reached; waiting ${Math.ceil(waitMs / 1000)} s for the reset`);
  await sleep(waitMs);
  return attempt();
}

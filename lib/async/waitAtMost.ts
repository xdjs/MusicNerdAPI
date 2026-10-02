/**
 * Waits for work, but no longer than `ms`. Unlike `withTimeout`, running out of
 * time isn't an error: the caller carries on with whatever has landed. The
 * work keeps running (nothing cancels it), as in MusicNerdWeb.
 *
 * @param promise - The work.
 * @param ms - The budget.
 * @returns The work's result, or undefined once the budget passes. A rejection passes through.
 */
export async function waitAtMost<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  const timer: { id?: ReturnType<typeof setTimeout> } = {};
  const budget = new Promise<undefined>(resolve => {
    timer.id = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([promise, budget]);
  } finally {
    clearTimeout(timer.id);
  }
}

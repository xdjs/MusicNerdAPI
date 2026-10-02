/**
 * Runs `task`, yielding each value it hands to `emit` while it runs, then
 * returns what the task resolved to, or rethrows what it rejected with. A
 * generator can't `yield` from inside a callback (a model call's
 * `onTextDelta`), so this is the bridge: `const doc = yield* yieldWhileRunning(...)`.
 *
 * The outcome is captured the moment the task settles, so a rejection that
 * lands while the caller is still consuming earlier values is never unhandled.
 *
 * @param task - The work, given an `emit` for progress values.
 * @returns A generator of the emitted values whose return value is the task's result.
 */
export async function* yieldWhileRunning<D, T>(
  task: (emit: (value: D) => void) => Promise<T>,
): AsyncGenerator<D, T> {
  const queue: D[] = [];
  const waker: { wake: (() => void) | null } = { wake: null };
  const state: { outcome: { ok: true; value: T } | { ok: false; error: unknown } | null } = {
    outcome: null,
  };
  const settled = task(value => {
    queue.push(value);
    waker.wake?.();
    waker.wake = null;
  }).then(
    value => {
      state.outcome = { ok: true, value };
      waker.wake?.();
      waker.wake = null;
    },
    error => {
      state.outcome = { ok: false, error };
      waker.wake?.();
      waker.wake = null;
    },
  );
  for (;;) {
    while (queue.length > 0) yield queue.shift() as D;
    if (state.outcome) break;
    await new Promise<void>(resolve => {
      waker.wake = resolve;
    });
  }
  await settled;
  const done = state.outcome as { ok: true; value: T } | { ok: false; error: unknown };
  if (!done.ok) throw done.error;
  return done.value;
}

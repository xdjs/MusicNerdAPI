/**
 * A bounded-concurrency streaming map: at most `concurrency` runs in flight,
 * each result yielded as it settles, so a large probe set never fires dozens
 * of requests at third-party servers at once.
 *
 * @param items - The inputs.
 * @param concurrency - The in-flight cap.
 * @param run - The work for one item.
 * @yields `[item, result]` in completion order.
 */
export async function* mapWithConcurrency<I, R>(
  items: I[],
  concurrency: number,
  run: (item: I) => Promise<R>,
): AsyncGenerator<[I, R]> {
  let nextIndex = 0;
  const inFlight = new Map<number, Promise<{ slot: number; item: I; result: R }>>();
  for (let slot = 0; slot < Math.min(concurrency, items.length); slot++) {
    const item = items[nextIndex++];
    inFlight.set(
      slot,
      run(item).then(result => ({ slot, item, result })),
    );
  }
  while (inFlight.size > 0) {
    const { slot, item, result } = await Promise.race(inFlight.values());
    inFlight.delete(slot);
    yield [item, result];
    if (nextIndex < items.length) {
      const next = items[nextIndex++];
      inFlight.set(
        slot,
        run(next).then(nextResult => ({ slot, item: next, result: nextResult })),
      );
    }
  }
}

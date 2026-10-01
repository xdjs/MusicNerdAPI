/**
 * Drains keyed promises in completion order, not creation order, so a fast
 * platform's result streams the instant it lands. Each entry is yielded once.
 * A rejected promise yields null for its key rather than ending the stream:
 * one failed job must not truncate every later platform.
 *
 * @param entries - `[key, promise]` pairs.
 * @yields `[key, value]`, or `[key, null]` for a rejection.
 */
export async function* settleAsCompleted<K, V>(
  entries: [key: K, promise: Promise<V>][],
): AsyncGenerator<[K, V | null]> {
  const remaining = new Map(
    entries.map(
      ([key, p]) =>
        [
          key,
          p.then(
            value => ({ key, value: value as V | null }),
            () => ({ key, value: null as V | null }),
          ),
        ] as const,
    ),
  );
  while (remaining.size > 0) {
    const { key, value } = await Promise.race(remaining.values());
    remaining.delete(key);
    yield [key, value];
  }
}

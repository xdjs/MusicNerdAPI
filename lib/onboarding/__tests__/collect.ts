/**
 * Drains an async generator into an array, for tests.
 *
 * @param gen - The generator.
 * @returns Everything it yielded.
 */
export async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

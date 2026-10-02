/**
 * One question per kind before a second of any, keeping the model's ranking
 * within a kind. A real run returned four credit questions about four people:
 * one question asked four times.
 *
 * @param items - Questions, best first.
 * @param max - The set size.
 * @returns Up to `max` items, spread across kinds.
 */
export function diversify<T extends { kind: string }>(items: T[], max: number): T[] {
  const picked: T[] = [];
  const used = new Set<string>();
  const remaining = [...items];
  while (picked.length < max && remaining.length > 0) {
    let i = remaining.findIndex(x => !used.has(x.kind));
    if (i === -1) {
      used.clear();
      i = 0;
    }
    const [item] = remaining.splice(i, 1);
    used.add(item.kind);
    picked.push(item);
  }
  return picked;
}

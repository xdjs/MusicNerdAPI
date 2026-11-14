/**
 * The cases to run, from the comma-separated `CHAT_CASES` value. An empty value runs all; a
 * case's follow-up row runs with its case, so selecting by case key is enough.
 *
 * @throws When a listed key is not a case, naming the unknown keys.
 */
export function selectChatCases<T extends { key: string }>(
  cases: T[],
  list: string | undefined,
): T[] {
  const keys = (list ?? "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);
  if (!keys.length) return cases;
  const unknown = keys.filter(k => !cases.some(c => c.key === k));
  if (unknown.length) throw new Error(`Unknown CHAT_CASES keys: ${unknown.join(", ")}`);
  return cases.filter(c => keys.includes(c.key));
}

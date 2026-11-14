/**
 * The cases to run, from the comma-separated `CHAT_CASES` value. An empty value runs all; a
 * case's follow-up row runs with its case, so selecting by case key is enough.
 *
 * With a case list, a `trials` of 2 to 5 (the `CHAT_TRIALS` value) sets how many times each
 * selected case is asked, replacing the case's own count; any other value, or no case list,
 * leaves the cases as they are. A case's follow-up still runs once.
 *
 * @throws When a listed key is not a case, naming the unknown keys.
 */
export function selectChatCases<T extends { key: string; trials?: number }>(
  cases: T[],
  list: string | undefined,
  trials?: string,
): T[] {
  const keys = (list ?? "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);
  if (!keys.length) return cases;
  const unknown = keys.filter(k => !cases.some(c => c.key === k));
  if (unknown.length) throw new Error(`Unknown CHAT_CASES keys: ${unknown.join(", ")}`);
  const picked = cases.filter(c => keys.includes(c.key));
  const text = trials?.trim() ?? "";
  const count = /^\d+$/.test(text) ? Number(text) : 0;
  return count >= 2 && count <= 5 ? picked.map(c => ({ ...c, trials: count })) : picked;
}

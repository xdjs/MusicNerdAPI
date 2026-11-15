/**
 * The cases to run, from the comma-separated `CHAT_CASES` value. An empty value runs all; a
 * case's follow-up row runs with its case, so selecting by case key is enough.
 *
 * A `trials` of 1 to 5 (the `CHAT_CASE_TRIALS` value) sets how many times every returned case is
 * asked, replacing the case's own count (1 removes repeats), whether or not a case list is
 * given; any other value leaves the cases as they are. A case's follow-up still runs once.
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
  const unknown = keys.filter(k => !cases.some(c => c.key === k));
  if (unknown.length) throw new Error(`Unknown CHAT_CASES keys: ${unknown.join(", ")}`);
  const picked = keys.length ? cases.filter(c => keys.includes(c.key)) : cases;
  const text = trials?.trim() ?? "";
  const count = /^\d+$/.test(text) ? Number(text) : 0;
  return count >= 1 && count <= 5 ? picked.map(c => ({ ...c, trials: count })) : picked;
}

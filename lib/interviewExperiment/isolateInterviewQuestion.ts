/** Remove a second explicit ask while preserving the first question's original wording.
 * @param question - A draft rejected for a compound interrogative.
 * @returns The first complete ask, or null when no safe syntactic split is available.
 */
export function isolateInterviewQuestion(question: string): string | null {
  const masked = question.replace(/[“"][^“”"]*[”"]/g, match => " ".repeat(match.length));
  const first = masked.indexOf("?");
  const compound = /(?:\b(?:and|or|but)\s+|;\s*)(?:what|how|why|when|where|which|who)\b/i.exec(
    masked,
  );
  const ends = [
    ...(first >= 0 && masked.indexOf("?", first + 1) >= 0 ? [first] : []),
    ...(compound ? [compound.index] : []),
  ];
  if (!ends.length) return null;
  const kept = question
    .slice(0, Math.min(...ends))
    .replace(/[\s,;:—–]+$/, "")
    .trim();
  if (kept.length < 8) return null;
  return kept + "?";
}

/** Lower-case, accent-free text with every run of non-letters and non-digits as one space. */
const normalise = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * A deterministic check that an answer names the items a question requires: the share of
 * `terms` that appear in `answer` as whole words, after normalising both (case, accents and
 * punctuation ignored; a leading "the" in a term is optional). Returns the terms that were
 * not found, as given, so a log can name them without printing the answer.
 */
export function scoreMentions(
  answer: string,
  terms: string[],
): { score: number; missing: string[] } {
  const padded = ` ${normalise(answer)} `;
  const missing = terms.filter(term => {
    const needle = normalise(term).replace(/^the /, "");
    return !needle || !padded.includes(` ${needle} `);
  });
  return {
    score: terms.length ? (terms.length - missing.length) / terms.length : 1,
    missing,
  };
}

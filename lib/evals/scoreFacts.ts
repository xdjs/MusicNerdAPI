/** One required fact: a single spelling, or alternatives any one of which counts. */
export type ChatFact = string | string[];

/** Lower-case, accent-free text with every run of non-letters and non-digits as one space. */
const normalise = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * A deterministic check that an answer states the facts a question requires: the share of
 * `facts` present in `answer`, after normalising both (case, accents and punctuation ignored;
 * a leading "the" in an alternative is optional; whole words only). A fact is present when any
 * one of its alternatives is. An alternative that normalises to nothing never matches, so a
 * fact with no usable alternative is missing. Returns the first alternative of each missing
 * fact, as given, so a log can name them without printing the answer.
 */
export function scoreFacts(
  answer: string,
  facts: ChatFact[],
): { score: number; missing: string[] } {
  const padded = ` ${normalise(answer)} `;
  const present = (alternative: string) => {
    const needle = normalise(alternative).replace(/^the /, "");
    return Boolean(needle) && padded.includes(` ${needle} `);
  };
  const missing = facts
    .filter(fact => !(Array.isArray(fact) ? fact : [fact]).some(present))
    .map(fact => (Array.isArray(fact) ? (fact[0] ?? "") : fact));
  return {
    score: facts.length ? (facts.length - missing.length) / facts.length : 1,
    missing,
  };
}

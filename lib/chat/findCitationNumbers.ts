/** A locator element: a page, section or paragraph marker. */
const LOCATOR = /^(p\.|§|¶)/u;
/** A citation number: the chat numbers at most 256 documents, so a year is never one. */
const NUMBER = /^[1-9]\d{0,2}$/;

/**
 * The citation markers in an answer, in the chat's grammar: a number in square brackets, where
 * `[13, 8, 86]` cites three and a mixed group such as `[19, 21, Artist Doc]` keeps its numbers. A
 * bracket with a locator (`[n, p.N]`, `[n, §Heading]`, `[n, ¶N]`) cites only its first element, so
 * `[1, §Live, 1999]` cites 1. A bracketed date (`[2026-05-13]`) and any number of four or more
 * digits are not citations; text outside brackets never is.
 *
 * @param text - The answer text.
 * @returns Every citation in order, repeats included, with its locator or null.
 */
export function findCitationNumbers(text: string): { n: number; locator: string | null }[] {
  const found: { n: number; locator: string | null }[] = [];
  for (const [, body] of text.matchAll(/\[([^\]]+)\]/g)) {
    const [first, ...rest] = body.split(",").map(part => part.trim());
    if (rest.length && LOCATOR.test(rest[0])) {
      if (NUMBER.test(first)) found.push({ n: Number(first), locator: rest.join(", ") });
      continue;
    }
    if (/\d{4}-\d{2}/.test(body)) continue;
    for (const part of [first, ...rest])
      if (NUMBER.test(part)) found.push({ n: Number(part), locator: null });
  }
  return found;
}

/**
 * Title-case, like a name or a place: "Colombia" counts, "HOUSE" (shouting) doesn't.
 *
 * @param token - A caption word.
 * @returns True for a capital followed by lowercase letters.
 */
export function isProperNounStyle(token: string): boolean {
  return /^[A-Z][a-z']*$/.test(token);
}

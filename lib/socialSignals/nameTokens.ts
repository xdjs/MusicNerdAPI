/**
 * The words of an artist's name, lowercase, for checking a track credit against.
 *
 * @param name - The artist's name.
 * @returns Its words of two letters or more.
 */
export function nameTokens(name: string): Set<string> {
  return new Set(name.toLowerCase().match(/[a-z']{2,}/g) ?? []);
}

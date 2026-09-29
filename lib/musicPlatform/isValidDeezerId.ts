/**
 * Deezer artist ids are numeric; anything else is never sent.
 *
 * @param id - A candidate id.
 * @returns True for digits only.
 */
export function isValidDeezerId(id: string): boolean {
  return /^\d+$/.test(id);
}

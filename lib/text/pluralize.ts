/**
 * The singular for a count of one, the plural otherwise.
 *
 * @param count - How many.
 * @param singular - The word for one.
 * @param plural - The word for any other count.
 * @returns The word to use.
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

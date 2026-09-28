/**
 * The usernames in a scraped list of users (`taggedUsers`, `coauthorProducers`).
 *
 * @param value - A field from an Apify item.
 * @returns Each entry's non-empty `username`, or an empty list when it is not an array.
 */
export function usernamesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => (entry && typeof entry === "object" ? entry.username : undefined))
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

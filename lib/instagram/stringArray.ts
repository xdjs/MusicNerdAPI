/**
 * The non-empty strings in a scraped list field.
 *
 * @param value - A field from an Apify item.
 * @returns Its non-empty strings, or an empty list when it is not an array.
 */
export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
}

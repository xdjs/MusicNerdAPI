/**
 * Decodes the few entities podcast pages put in attribute values.
 *
 * @param value - A raw attribute value.
 * @returns The value, decoded and trimmed.
 */
export function decodePodcastAttribute(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

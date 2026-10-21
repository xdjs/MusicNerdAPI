/**
 * A link safe to show: https only, no credentials. Links come from stored
 * sources or catalog responses, never generated prose.
 *
 * @param value - A stored URL.
 * @returns The URL, or null when it isn't a safe https URL.
 */
export function latestExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A stored artist portrait the site may show: a local path or a
 * credential-free HTTPS URL. Placeholders and anything else become null.
 *
 * @param value - The artist's `custom_image` column.
 * @returns The usable image reference, or null.
 */
export function normalizeStoredArtistImage(value: string | null | undefined): string | null {
  const stored = value?.trim();
  if (!stored || /default|placeholder|musicnerdlogo/i.test(stored)) return null;
  if (stored.startsWith("/") && !stored.startsWith("//") && !stored.includes("\\")) return stored;
  try {
    const url = new URL(stored);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

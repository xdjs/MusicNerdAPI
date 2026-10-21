import { customImageUrl } from "@/lib/account/customImageUrl";

/**
 * A stored artist image the bookmarks list may show: a site-relative path, or
 * an `https:` URL without credentials. Anything else is dropped.
 *
 * @param value - The `custom_image` column value.
 * @returns The safe URL, or null.
 */
export function storedImage(value: string | null): string | null {
  const trimmed = customImageUrl(value);
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\"))
    return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

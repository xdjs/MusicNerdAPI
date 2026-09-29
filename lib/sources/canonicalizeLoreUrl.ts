import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * One stored identity for URLs that differ only by fragment or serialization.
 *
 * @param input - A URL.
 * @returns The canonical URL, or null when it isn't a public URL.
 */
export function canonicalizeLoreUrl(input: string): string | null {
  const normalized = normalizePublicUrl(input);
  if (!normalized) return null;
  const url = new URL(normalized);
  url.hash = "";
  return url.href;
}

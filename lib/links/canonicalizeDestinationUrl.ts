import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * A destination URL's serialization, for comparing destinations without
 * merging distinct paths, queries or hash routes.
 *
 * @param input - A URL.
 * @returns The serialized URL, or null when it isn't a public URL.
 */
export function canonicalizeDestinationUrl(input: string): string | null {
  const normalized = normalizePublicUrl(input);
  return normalized ? new URL(normalized).href : null;
}

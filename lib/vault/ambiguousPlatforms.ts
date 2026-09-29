import type { ResolvedHandle } from "@/lib/vault/types";

/**
 * Platforms a page gives two different handles for, such as an artist's own
 * Instagram beside their label's. The run abstains on those.
 *
 * @param resolved - The page's resolved handles.
 * @returns The ambiguous platforms.
 */
export function ambiguousPlatforms(resolved: ResolvedHandle[]): Set<string> {
  return new Set(
    resolved
      .filter(r => resolved.some(o => o.siteName === r.siteName && o.id !== r.id))
      .map(r => r.siteName),
  );
}

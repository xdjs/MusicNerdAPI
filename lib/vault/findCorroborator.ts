import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import type { ResolvedHandle } from "@/lib/vault/types";

/**
 * A link on the page to an id we already hold for the artist, which makes the
 * page theirs: identity through a matched (platform, id), never a name.
 * Normalized on both sides, since stored values may carry a leading "@".
 *
 * @param resolved - The page's resolved handles.
 * @param artist - The artist row snapshot.
 * @returns The corroborating handle, or undefined.
 */
export function findCorroborator(
  resolved: ResolvedHandle[],
  artist: Record<string, unknown>,
): ResolvedHandle | undefined {
  return resolved.find(r => {
    const held = artist[r.siteName];
    return typeof held === "string" && !!held && normalizeHandle(held) === r.id;
  });
}

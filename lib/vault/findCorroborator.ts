import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { CASE_SENSITIVE_ACCOUNT_IDS } from "@/lib/vault/const";
import type { ResolvedHandle } from "@/lib/vault/types";

/**
 * A link on the page to an id we already hold for the artist, which makes the
 * page theirs: identity through a matched (platform, id), never a name.
 * Normalized on both sides, since stored values may carry a leading "@".
 * A discovery guess never corroborates: a namesake's account would vouch for
 * the namesake's page.
 *
 * @param resolved - The page's resolved handles.
 * @param artist - The artist row snapshot.
 * @param provisional - Columns holding a discovery guess (see holdsAnswerFor).
 * @returns The corroborating handle, or undefined.
 */
export function findCorroborator(
  resolved: ResolvedHandle[],
  artist: Record<string, unknown>,
  provisional?: Set<string>,
): ResolvedHandle | undefined {
  return resolved.find(r => {
    if (provisional?.has(r.siteName)) return false;
    const held = artist[r.siteName];
    if (typeof held !== "string" || !held) return false;
    return (
      (CASE_SENSITIVE_ACCOUNT_IDS.has(r.siteName) ? held.trim() : normalizeHandle(held)) === r.id
    );
  });
}

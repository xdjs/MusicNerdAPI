import { normalizeHandle } from "@/lib/instagram/normalizeHandle";

/**
 * Dedupes handles and drops the artist's own: a coauthor or tagged-user list
 * can legitimately include the artist themselves.
 *
 * @param handles - Handles as scraped.
 * @param selfNorm - The artist's handle, normalized.
 * @returns Each other handle once, first spelling kept, without "@".
 */
export function dedupeExcludingSelf(handles: string[], selfNorm: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of handles) {
    const key = normalizeHandle(h);
    if (!key || key === selfNorm || seen.has(key)) continue;
    seen.add(key);
    out.push(h.trim().replace(/^@/, ""));
  }
  return out;
}

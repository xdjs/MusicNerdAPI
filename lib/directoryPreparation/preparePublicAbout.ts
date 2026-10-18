import { extractCitedIds } from "@/lib/lore/extractCitedIds";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import type { DirectoryMaterial, DirectoryDraft, PublicAbout } from "./types";
/** Preserve citation ancestry through document-to-About summarization without exposing private originals. */
export function preparePublicAbout(
  material: DirectoryMaterial,
  draft: DirectoryDraft,
): PublicAbout | null {
  if (draft.status !== "ready" || !draft.about) return null;
  const aboutIds = extractCitedIds(draft.about);
  if (!aboutIds.size) return null;
  const ids = [...new Set([...extractCitedIds(draft.document ?? ""), ...aboutIds])];
  if (ids.some(id => !material.manifest[id - 1])) return null;
  const sources = ids.map(id => material.manifest[id - 1]);
  if (sources.some(source => !normalizePublicUrl(source.url) || isUnsafeUrl(source.url)))
    return null;
  const bio = stripCitationMarkers(draft.about);
  if (!bio) return null;
  return {
    version: 1,
    identity: { name: material.artistName, accounts: material.accounts ?? {} },
    bio,
    kind: "researched",
    sources: sources.map(source => ({
      id: source.id,
      url: source.url,
      label: (source.title || new URL(source.url).hostname).slice(0, 300),
    })),
  };
}

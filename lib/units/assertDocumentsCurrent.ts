import { findCurrentDocuments } from "@/lib/units/findCurrentDocuments";
import type { UnitSourceKind } from "@/lib/units/types";

/**
 * Throws unless every document is still public for this artist at the revision given
 * (`findCurrentDocuments`: one query, none for an empty list). The error names no document or text.
 *
 * @param artistId - The artist.
 * @param refs - The documents and the revisions they were read at.
 */
export async function assertDocumentsCurrent(
  artistId: string,
  refs: { sourceKind: UnitSourceKind; sourceId: string; revision: string }[],
): Promise<void> {
  if (refs.length === 0) return;
  const current = await findCurrentDocuments(artistId, refs);
  if (!refs.every(ref => current.has(`${ref.sourceKind}:${ref.sourceId}:${ref.revision}`)))
    throw new Error("Source changed or is no longer public");
}

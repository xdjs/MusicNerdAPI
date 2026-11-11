import { projectSavedPublicBio } from "../../../lib/bio/projectSavedPublicBio";

/** ISOLATED policy candidate: preserve stored text, hide unproven public prose without inventing lineage. */
export function projectEvidenceBackedBio(
  row: Parameters<typeof projectSavedPublicBio>[0],
  projector: typeof projectSavedPublicBio = projectSavedPublicBio,
): string | null {
  if (row.provenance === null || row.provenance === undefined) return null;
  if (typeof row.provenance === "object") {
    const p = row.provenance as Record<string, unknown>;
    if (p.kind === "generated" && Array.isArray(p.sources) && p.sources.length === 0) return null;
  }
  // Existing validator still enforces hash/claim/sources. No automatic authored conversion.
  return projector(row);
}

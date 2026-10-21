import { MAX_BIO_LENGTH } from "@/lib/bio/const";
import { isRealBio } from "@/lib/bio/isRealBio";
import type { PublicArtistAbout } from "@/lib/bioCorrections/types";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * Reads a stored `public_about` into the public About. Explicit version
 * opt-in: old private drafts are never a public biography. Copied from
 * MusicNerdWeb's `parsePublicArtistAbout`.
 *
 * @param value - The `artist_directory_preparations.public_about` JSON.
 * @returns The About, or null when the value isn't a valid public About.
 */
export function parsePublicArtistAbout(value: unknown): PublicArtistAbout | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.version !== 1 ||
    typeof row.bio !== "string" ||
    !isRealBio(row.bio) ||
    row.bio.length > MAX_BIO_LENGTH ||
    !["official", "researched"].includes(String(row.kind)) ||
    !Array.isArray(row.sources) ||
    !row.sources.length ||
    row.sources.length > 40
  )
    return null;
  const sources: PublicArtistAbout["sources"] = [];
  for (const source of row.sources) {
    if (
      !source ||
      typeof source !== "object" ||
      typeof source.id !== "string" ||
      typeof source.url !== "string" ||
      !/^https?:\/\//.test(source.url) ||
      !normalizePublicUrl(source.url) ||
      typeof source.label !== "string" ||
      source.label.length > 500
    )
      return null;
    sources.push({ id: source.id, url: source.url, label: source.label });
  }
  return { bio: row.bio, kind: row.kind as PublicArtistAbout["kind"], sources };
}

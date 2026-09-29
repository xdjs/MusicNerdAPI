/**
 * Letters and digits only, lowercased, for comparing a name, handle or domain
 * label against another. No Unicode decomposition: this is MusicNerdWeb's
 * `folded` / MusicBrainz `fold`, not `foldName`.
 *
 * @param v - A name, handle or label.
 * @returns The folded form.
 */
export function foldAlnum(v: string): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

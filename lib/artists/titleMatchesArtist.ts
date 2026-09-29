import { foldName } from "@/lib/text/foldName";

/**
 * Loose containment, either direction. A profile's og:title rarely equals the
 * name ("Pete Rango (@p3t3rango) • Instagram photos and videos"), but a
 * different person's title won't contain it at all.
 *
 * @param title - A page title.
 * @param artistName - The artist's name.
 * @returns True when either folded string contains the other.
 */
export function titleMatchesArtist(title: string, artistName: string): boolean {
  const t = foldName(title);
  const a = foldName(artistName);
  if (!t || !a) return false;
  return t.includes(a) || a.includes(t);
}

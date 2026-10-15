import { foldName } from "@/lib/text/foldName";
import type { RecordingMatch } from "./types";

/** Automatic attachment needs an uncontested catalog identity, never a name search or repeated row. */
export function chooseVerifiedSpotifyMatch(
  name: string,
  matches: RecordingMatch[],
):
  | { status: "verified"; spotifyId: string; recordings: number }
  | { status: "ambiguous" | "not_found" } {
  if (matches.some(match => match.incomplete)) return { status: "ambiguous" };
  const counts = new Map<string, { name: string; isrcs: Set<string> }>();
  for (const match of matches)
    for (const artist of match.artists) {
      if (!/^[A-Za-z0-9]{22}$/.test(artist.id)) continue;
      const count = counts.get(artist.id) ?? { name: artist.name, isrcs: new Set<string>() };
      count.isrcs.add(match.isrc.toUpperCase());
      counts.set(artist.id, count);
    }
  if (!counts.size) return { status: "not_found" };
  const ranked = [...counts].sort((a, b) => b[1].isrcs.size - a[1].isrcs.size);
  const [id, winner] = ranked[0];
  if (
    winner.isrcs.size < 2 ||
    ranked[1]?.[1].isrcs.size === winner.isrcs.size ||
    foldName(winner.name) !== foldName(name)
  )
    return { status: "ambiguous" };
  return { status: "verified", spotifyId: id, recordings: winner.isrcs.size };
}

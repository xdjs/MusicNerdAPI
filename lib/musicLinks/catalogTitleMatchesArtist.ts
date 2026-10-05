import { foldName } from "@/lib/text/foldName";

/** Match the full artist name after removing only recognized catalog title decorations. */
export function catalogTitleMatchesArtist(
  title: string,
  artistName: string,
  platform: string,
): boolean {
  const name = foldName(artistName);
  if (!name) return false;
  let candidate = title.replace(/\p{Cf}/gu, "").trim();
  if (foldName(candidate) === name) return true;
  const brands: Record<string, string> = {
    apple_music: "Apple Music",
    beatport: "Beatport",
    spotify: "Spotify",
    deezer: "Deezer",
    tidal: "TIDAL",
    qobuz: "Qobuz",
    amazon_music: "Amazon Music(?: Unlimited)?",
    bandcamp: "Bandcamp",
    subvert: "Subvert",
    supercollector: "Supercollector",
    soundcloud: "SoundCloud",
    audius: "Audius",
    mixcloud: "Mixcloud",
  };
  const brand = brands[platform];
  if (!brand) return false;
  if (platform === "soundcloud") {
    candidate = candidate.replace(
      /^Stream (.+) music \| Listen to songs, albums, playlists for free on SoundCloud$/i,
      "$1",
    );
  }
  candidate = candidate.replace(
    new RegExp(`\\s+(?:[-–—|•]\\s*(?:Listen on\\s+)?|on\\s+)${brand}$`, "i"),
    "",
  );
  if (platform === "bandcamp") candidate = candidate.replace(/^Music\s*\|\s*/i, "");
  if (platform === "beatport") candidate = candidate.replace(/\s+Music\s*&\s*Downloads$/i, "");
  if (platform === "deezer")
    candidate = candidate.replace(/:\s*albums,\s*songs,\s*playlists$/i, "");
  return foldName(candidate) === name;
}

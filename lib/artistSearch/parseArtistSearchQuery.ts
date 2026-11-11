import { InvalidArtistSearchQueryError } from "@/lib/artistSearch/InvalidArtistSearchQueryError";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

/** Parse supported identities without resolving a supplied URL. Bare IDs retain name search. */
export function parseArtistSearchQuery(query: string): {
  platform: MusicPlatform;
  platformId: string;
  includeNameResults: boolean;
} | null {
  const input = query.trim();
  if (/^[1-9]\d*$/.test(input))
    return { platform: "deezer", platformId: input, includeNameResults: true };
  if (/^[A-Za-z0-9]{22}$/.test(input))
    return { platform: "spotify", platformId: input, includeNameResults: true };
  const uri = /^spotify:artist:([A-Za-z0-9]{22})$/.exec(input);
  if (uri) return { platform: "spotify", platformId: uri[1], includeNameResults: false };
  if (
    !/^[a-z][a-z\d+.-]*:\/\/|^(?:https?|spotify|deezer|mailto|javascript|data|file|ftp):|^\/\/|^(?:www\.|open\.spotify\.com|deezer\.com)/i.test(
      input,
    )
  )
    return null;
  // Match original text, not normalized paths that can hide credentials or dot segments.
  const spotify =
    /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]{22})\/?(?:[?#][^\s\\]*)?$/.exec(
      input,
    );
  if (spotify) return { platform: "spotify", platformId: spotify[1], includeNameResults: false };
  const deezer =
    /^https:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?artist\/([1-9]\d*)\/?(?:[?#][^\s\\]*)?$/.exec(
      input,
    );
  if (deezer) return { platform: "deezer", platformId: deezer[1], includeNameResults: false };
  throw new InvalidArtistSearchQueryError();
}

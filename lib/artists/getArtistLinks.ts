import { getAllLinks } from "@/lib/artists/getAllLinks";
import type { ArtistLink, ArtistRow } from "@/lib/artists/types";

/**
 * The artist's platform links, each urlmap row the artist holds a value for
 * with its URL built from the row's template, in urlmap order. YouTube and
 * Facebook each have a username and an id column; the username wins when both
 * are set. Ported from MusicNerdWeb's `getArtistLinks`.
 *
 * @param artist - The artist row.
 * @returns The links; throws "Error fetching artist links" on failure.
 */
export async function getArtistLinks(artist: ArtistRow): Promise<ArtistLink[]> {
  try {
    const allLinkObjects = await getAllLinks();
    if (!artist) throw new Error("Artist not found");
    const artistLinksSiteNames: ArtistLink[] = [];
    const row = artist as unknown as Record<string, unknown>;
    const hasYoutubeUsername = artist.youtube?.toString()?.trim();
    const hasYoutubeChannel = artist.youtubechannel?.toString()?.trim();
    const hasFacebookUsername = artist.facebook?.toString()?.trim();
    const hasFacebookId = artist.facebookId?.toString()?.trim();

    for (const platform of allLinkObjects) {
      if (platform.siteName === "ens" || platform.siteName === "wallets") continue;
      // Prefer the username when both YouTube columns, or both Facebook columns, are set.
      if (platform.siteName === "youtubechannel" && hasYoutubeUsername && hasYoutubeChannel)
        continue;
      if (platform.siteName === "facebookID" && hasFacebookUsername && hasFacebookId) continue;

      // The siteName "facebookID" is the row property "facebookId".
      const artistPropertyName =
        platform.siteName === "facebookID" ? "facebookId" : platform.siteName;
      const value = row[artistPropertyName];

      if (artistPropertyName in row && value !== null && value !== undefined && value !== "") {
        let artistUrl = platform.appStringFormat;
        if (platform.siteName === "youtubechannel") {
          const youtubeChannelValue = artist.youtubechannel?.toString()?.trim() ?? "";
          if (youtubeChannelValue) {
            if (youtubeChannelValue.startsWith("@")) {
              // Username data stored in the channel column (legacy state).
              artistUrl = `https://youtube.com/@${youtubeChannelValue.substring(1)}`;
            } else {
              artistUrl = `https://www.youtube.com/channel/${youtubeChannelValue}`;
            }
          } else {
            continue;
          }
        } else if (platform.siteName === "youtube") {
          const youtubeUsername = artist.youtube?.toString()?.trim() ?? "";
          if (youtubeUsername) {
            const cleanUsername = youtubeUsername.startsWith("@")
              ? youtubeUsername.substring(1)
              : youtubeUsername;
            artistUrl = `https://youtube.com/@${cleanUsername}`;
          } else {
            continue;
          }
        } else if (platform.siteName === "supercollector") {
          const text = artist.supercollector?.toString() ?? "";
          const ethRemoved = text.endsWith(".eth") ? text.slice(0, -4) : text;
          artistUrl = platform.appStringFormat.replace("%@", ethRemoved);
        } else if (platform.siteName === "soundcloud") {
          const text = artist.soundcloud?.toString() ?? "";
          if (!text || /^\d+$/.test(text)) continue;
          artistUrl = platform.appStringFormat.replace("%@", text);
        } else if (platform.siteName === "facebookID") {
          // The facebookID column stores full URLs.
          const facebookUrl = artist.facebookId?.toString()?.trim() ?? "";
          if (facebookUrl) {
            artistUrl = facebookUrl;
          } else {
            continue;
          }
        } else {
          artistUrl = platform.appStringFormat.replace("%@", value?.toString() ?? "");
        }
        artistLinksSiteNames.push({ ...platform, artistUrl });
      }
    }
    artistLinksSiteNames.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return artistLinksSiteNames;
  } catch {
    throw new Error("Error fetching artist links");
  }
}

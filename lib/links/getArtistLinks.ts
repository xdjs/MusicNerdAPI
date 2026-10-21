import { getAllLinks } from "@/lib/artists/getAllLinks";
import type { ArtistRow } from "@/lib/artists/types";
import type { ArtistLink } from "@/lib/links/types";

/**
 * The artist's filled link columns as urlmap rows with the artist's URL, in
 * urlmap order. Where both are filled, the YouTube and Facebook usernames are
 * preferred over the channel id and the Facebook id.
 *
 * @param artist - The artist row.
 * @returns The links. Throws "Error fetching artist links" when they can't be built.
 */
export async function getArtistLinks(artist: ArtistRow): Promise<ArtistLink[]> {
  try {
    const allLinkObjects = await getAllLinks();
    if (!artist) throw new Error("Artist not found");
    const links: ArtistLink[] = [];
    const row = artist as unknown as Record<string, unknown>;
    const hasYoutubeUsername = artist.youtube?.toString()?.trim();
    const hasYoutubeChannel = artist.youtubechannel?.toString()?.trim();
    const hasFacebookUsername = artist.facebook?.toString()?.trim();
    const hasFacebookId = artist.facebookId?.toString()?.trim();

    for (const platform of allLinkObjects) {
      if (platform.siteName === "ens" || platform.siteName === "wallets") continue;
      if (platform.siteName === "youtubechannel" && hasYoutubeUsername && hasYoutubeChannel)
        continue;
      if (platform.siteName === "facebookID" && hasFacebookUsername && hasFacebookId) continue;
      // The urlmap's "facebookID" is the row's `facebookId`.
      const property = platform.siteName === "facebookID" ? "facebookId" : platform.siteName;
      if (
        !(property in row) ||
        row[property] === null ||
        row[property] === undefined ||
        row[property] === ""
      )
        continue;
      let artistUrl = platform.appStringFormat;
      if (platform.siteName === "youtubechannel") {
        const channel = row[platform.siteName]?.toString()?.trim() ?? "";
        if (!channel) continue;
        // An @ means a username saved in the channel column (legacy rows).
        artistUrl = channel.startsWith("@")
          ? `https://youtube.com/@${channel.substring(1)}`
          : `https://www.youtube.com/channel/${channel}`;
      } else if (platform.siteName === "youtube") {
        const username = row[platform.siteName]?.toString()?.trim() ?? "";
        if (!username) continue;
        artistUrl = `https://youtube.com/@${username.startsWith("@") ? username.substring(1) : username}`;
      } else if (platform.siteName === "supercollector") {
        const value = row[platform.siteName]?.toString() ?? "";
        artistUrl = platform.appStringFormat.replace(
          "%@",
          value.endsWith(".eth") ? value.slice(0, -4) : value,
        );
      } else if (platform.siteName === "soundcloud") {
        const value = row[platform.siteName]?.toString() ?? "";
        if (!value || /^\d+$/.test(value)) continue;
        artistUrl = platform.appStringFormat.replace("%@", value);
      } else if (platform.siteName === "facebookID") {
        // The column stores the full Facebook URL.
        const facebookUrl = artist.facebookId?.toString()?.trim() ?? "";
        if (!facebookUrl) continue;
        artistUrl = facebookUrl;
      } else {
        artistUrl = platform.appStringFormat.replace("%@", row[property]?.toString() ?? "");
      }
      links.push({ ...platform, artistUrl });
    }
    links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return links;
  } catch {
    throw new Error("Error fetching artist links");
  }
}

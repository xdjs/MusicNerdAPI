import { it, expect } from "vitest";
import { getProfileLinks } from "@/lib/links/getProfileLinks";
import type { ArtistLink } from "@/lib/links/types";

const link = (siteName: string, artistUrl: string, extra: Partial<ArtistLink> = {}) =>
  ({
    siteName,
    artistUrl,
    isMonetized: false,
    cardPlatformName: null,
    siteImage: null,
    ...extra,
  }) as ArtistLink;

it("leads Links with Spotify and Deezer and splits Support by platform", () => {
  const links = [
    link("instagram", "https://instagram.com/pete", {
      cardPlatformName: "Instagram",
      siteImage: "/ig.svg",
    }),
    link("bandcamp", "https://pete.bandcamp.com"),
    link("patreon", "https://patreon.com/pete", { isMonetized: true }),
    link("spotify", "https://open.spotify.com/artist/other"),
    link("x", "http://x.com/pete"),
  ];
  expect(getProfileLinks({ spotify: "sp1", deezer: " " }, links, "links")).toEqual([
    {
      siteName: "spotify",
      href: "https://open.spotify.com/artist/sp1",
      label: "Spotify",
      iconSrc: "/siteIcons/spotify_icon.svg",
    },
    {
      siteName: "instagram",
      href: "https://instagram.com/pete",
      label: "Instagram",
      iconSrc: "/ig.svg",
    },
  ]);
  expect(
    getProfileLinks({ spotify: null, deezer: null }, links, "support").map(l => [
      l.siteName,
      l.iconSrc,
    ]),
  ).toEqual([
    ["bandcamp", "/siteIcons/bandcamp_icon.svg"],
    ["patreon", ""],
  ]);
});

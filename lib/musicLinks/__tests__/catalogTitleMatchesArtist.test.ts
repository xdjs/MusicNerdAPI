import { expect, it } from "vitest";
import { catalogTitleMatchesArtist } from "../catalogTitleMatchesArtist";

it.each([
  ["Black Dave", "Dave", "apple_music"],
  ["Dave", "Black Dave", "apple_music"],
  ["Black Dave", "Dave — Apple Music", "apple_music"],
  ["Dave", "Black Dave | Beatport", "beatport"],
  ["AB", "Gabrielle on Spotify", "spotify"],
  ["Grimes", "Grimes tribute band — Apple Music", "apple_music"],
  ["Grimes", "Grimes — a review", "apple_music"],
  ["Grimes", "Grimes | Beatport", "apple_music"],
  ["Grimes", "Grimes tribute band on Amazon Music Unlimited", "amazon_music"],
  ["Grimes", "Grimes on Amazon Music Unlimited", "apple_music"],
  ["", "Apple Music", "apple_music"],
])("rejects partial or unrelated identity for %s: %s", (name, title, platform) => {
  expect(catalogTitleMatchesArtist(title, name, platform)).toBe(false);
});

it.each([
  ["Black Dave", "Black Dave", "apple_music"],
  ["Black Dave", "‎Black Dave — Apple Music", "apple_music"],
  ["Black Dave", "Black Dave | Beatport", "beatport"],
  ["Grimes", "Grimes Music & Downloads on Beatport", "beatport"],
  ["Sigur Rós", "Sigur Ros | Spotify", "spotify"],
  ["Grimes", "Music | Grimes", "bandcamp"],
  ["Grimes", "Grimes on Amazon Music", "amazon_music"],
  ["Grimes", "Grimes on Amazon Music Unlimited", "amazon_music"],
  [
    "Anonymous Artists (어나니머스 아티스트)",
    "Anonymous Artists (어나니머스 아티스트) on Amazon Music Unlimited",
    "amazon_music",
  ],
  ["Grimes", "Grimes: albums, songs, playlists | Listen on Deezer", "deezer"],
  [
    "Grimes",
    "Stream Grimes music | Listen to songs, albums, playlists for free on SoundCloud",
    "soundcloud",
  ],
  ["Grimes", "Grimes • Audius", "audius"],
])("accepts the complete artist %s with a supported decoration: %s", (name, title, platform) => {
  expect(catalogTitleMatchesArtist(title, name, platform)).toBe(true);
});

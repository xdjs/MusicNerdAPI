/** A platform `validateLink` can check: its built-in URL pattern and the phrases its not-found page shows. */
export type ValidatedPlatform = { name: string; regex: RegExp; errorPhrases: string[] };

const YOUTUBE_ERROR_PHRASES = [
  "This page isn't available",
  "404 Not Found",
  "Channel does not exist",
  "has been terminated",
  "is not available",
  "This account has been terminated",
  "The page you are looking for does not exist",
  "<title>Not Found</title>",
  "<title>404 Not Found</title>",
];

const NOT_FOUND_PAGE_PHRASES = [
  "404 Not Found",
  "This page could not be found",
  "<title>404 Not Found</title>",
];

/**
 * MusicNerdWeb's platforms, patterns and error phrases, verbatim. A urlmap
 * pattern for the same platform replaces the built-in one per request.
 */
export const VALIDATED_PLATFORMS: ValidatedPlatform[] = [
  {
    name: "youtube",
    regex: /^https?:\/\/(www\.)?youtube\.com\/(?:@([^\/?#]+)|([^\/?#]+))(?:[\/?#].*)?$/,
    errorPhrases: YOUTUBE_ERROR_PHRASES,
  },
  {
    name: "youtubechannel",
    regex: /^https?:\/\/(www\.)?youtube\.com\/channel\/([^\/?#]+)(?:[\/?#].*)?$/,
    errorPhrases: YOUTUBE_ERROR_PHRASES,
  },
  {
    name: "soundcloud",
    regex: /^https?:\/\/(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+/,
    errorPhrases: [
      "Sorry! We can't find that user.",
      "We can't find that user.",
      "We can't find that user.",
      "We couldn't find that page.",
      "404 Not Found",
      "<title>404 Not Found</title>",
      "<title>Something went wrong on SoundCloud</title>",
    ],
  },
  {
    name: "bandcamp",
    regex:
      /^https?:\/\/(?:([A-Za-z0-9_-]+)\.bandcamp\.[^\/]+|(?:www\.)?bandcamp\.com\/[A-Za-z0-9_-]+)/,
    errorPhrases: [
      "Sorry, that something isn't here.",
      "404 Not Found",
      "<title>404 Not Found</title>",
      "<title>Signup | Bandcamp</title>",
    ],
  },
  {
    name: "audius",
    regex: /^https?:\/\/(www\.)?audius\.co\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "User not found", "<title>404 Not Found</title>"],
  },
  {
    name: "lastfm",
    regex: /^https?:\/\/(www\.)?last\.fm\/(user|music)\/[A-Za-z0-9_-]+/,
    errorPhrases: ["User not found", "404 Not Found", "<title>404 Not Found</title>"],
  },
  {
    name: "opensea",
    regex: /^https?:\/\/(www\.)?opensea\.io\/[A-Za-z0-9_-]+/,
    errorPhrases: NOT_FOUND_PAGE_PHRASES,
  },
  {
    name: "zora",
    regex: /^https?:\/\/(www\.)?zora\.co\/[A-Za-z0-9_-]+/,
    errorPhrases: NOT_FOUND_PAGE_PHRASES,
  },
  {
    name: "catalog",
    regex: /^https?:\/\/(www\.)?catalog\.works\/[A-Za-z0-9_-]+/,
    errorPhrases: NOT_FOUND_PAGE_PHRASES,
  },
  {
    name: "supercollector",
    regex: /^https?:\/\/(www\.)?supercollector\.xyz\/[A-Za-z0-9_-]+/,
    errorPhrases: NOT_FOUND_PAGE_PHRASES,
  },
  {
    name: "mintsongs",
    regex: /^https?:\/\/(www\.)?mintsongs\.com\/[A-Za-z0-9_-]+/,
    errorPhrases: NOT_FOUND_PAGE_PHRASES,
  },
];

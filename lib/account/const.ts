import { z } from "zod";

/** Every bookmarks response is private to the token's user. */
export const BOOKMARK_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization, X-Bookmark-Account",
} as const;

/** An artist id as the bookmark bodies accept it: a UUID, stored lower-cased. */
export const bookmarkArtistId = z
  .string()
  .uuid()
  .transform(value => value.toLowerCase());

/** The artist-id lists the bookmark bodies accept. */
export const bookmarkArtistIds = z.array(bookmarkArtistId).max(500);

/** An EVM wallet address. */
export const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

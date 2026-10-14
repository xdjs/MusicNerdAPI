/**
 * MusicNerdWeb's whole `artists` table, column for column and in its order
 * (`src/server/db/schema.ts`), for the artist lookups that must return the row
 * exactly as the website's routes did (xdjs/MusicNerdWeb#1480). Kept apart from
 * `lib/db/schema.ts` so no other endpoint starts returning internal columns.
 *
 * Every column is named explicitly. Drizzle caches unnamed columns per table name,
 * and `lib/db/schema.ts` also declares `artists`, so once that table is queried an
 * unnamed column it lacks (`wallets`, `webmapdata`) would render as "undefined".
 */
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const lookupArtists = pgTable("artists", {
  id: uuid("id").primaryKey().notNull(),
  legacyId: text("legacy_id"),
  bandcamp: text("bandcamp"),
  facebook: text("facebook"),
  x: text("x"),
  soundcloud: text("soundcloud"),
  notes: text("notes"),
  patreon: text("patreon"),
  name: text("name"),
  instagram: text("instagram"),
  youtube: text("youtube"),
  youtubechannel: text("youtubechannel"),
  lcname: text("lcname"),
  soundcloudId: integer("soundcloudID"),
  spotify: text("spotify"),
  twitch: text("twitch"),
  imdb: text("imdb"),
  musicbrainz: text("musicbrainz"),
  wikidata: text("wikidata"),
  mixcloud: text("mixcloud"),
  facebookId: text("facebookID"),
  discogs: text("discogs"),
  tiktok: text("tiktok"),
  tiktokId: text("tiktokID"),
  jaxsta: text("jaxsta"),
  famousbirthdays: text("famousbirthdays"),
  songexploder: text("songexploder"),
  colorsxstudios: text("colorsxstudios"),
  bandsintown: text("bandsintown"),
  linktree: text("linktree"),
  onlyfans: text("onlyfans"),
  wikipedia: text("wikipedia"),
  audius: text("audius"),
  zora: text("zora"),
  catalog: text("catalog"),
  opensea: text("opensea"),
  foundation: text("foundation"),
  lastfm: text("lastfm"),
  linkedin: text("linkedin"),
  soundxyz: text("soundxyz"),
  mirror: text("mirror"),
  glassnode: text("glassnode"),
  collectsNfTs: boolean("collectsNFTs"),
  spotifyusername: text("spotifyusername"),
  bandcampfan: text("bandcampfan"),
  tellie: text("tellie"),
  wallets: text("wallets").array(),
  ens: text("ens"),
  lens: text("lens"),
  addedBy: uuid("added_by"),
  cameo: text("cameo"),
  farcaster: text("farcaster"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
  supercollector: text("supercollector"),
  bio: text("bio"),
  customImage: text("custom_image"),
  headerImagePosition: jsonb("header_image_position"),
  linkOrder: jsonb("link_order"),
  webmapdata: jsonb("webmapdata"),
  nodePfp: jsonb("node_pfp"),
  deezer: text("deezer"),
  subvert: text("subvert"),
  bluesky: text("bluesky"),
  inprocess: text("inprocess"),
});

/** A whole artist row, in MusicNerdWeb's shape. */
export type LookupArtist = typeof lookupArtists.$inferSelect;

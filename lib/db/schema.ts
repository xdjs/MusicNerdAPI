/**
 * The tables this API reads and writes, copied from MusicNerdWeb's
 * `src/server/db/schema.ts`. MusicNerdWeb owns the schema and its migrations;
 * this file declares only the columns this API uses. Keep them in step.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const claimStatus = pgEnum("claim_status", ["pending", "approved", "rejected"]);
export const sourceStatus = pgEnum("source_status", ["pending", "approved", "rejected"]);

/** The artist row with every link column, since link writes and the identity gates read them by name. */
export const artists = pgTable("artists", {
  id: uuid().primaryKey().notNull(),
  name: text(),
  bio: text(),
  bandcamp: text(),
  facebook: text(),
  x: text(),
  soundcloud: text(),
  patreon: text(),
  instagram: text(),
  youtube: text(),
  youtubechannel: text(),
  spotify: text(),
  twitch: text(),
  imdb: text(),
  musicbrainz: text(),
  wikidata: text(),
  mixcloud: text(),
  facebookId: text("facebookID"),
  discogs: text(),
  tiktok: text(),
  tiktokId: text("tiktokID"),
  jaxsta: text(),
  famousbirthdays: text(),
  songexploder: text(),
  colorsxstudios: text(),
  bandsintown: text(),
  linktree: text(),
  onlyfans: text(),
  wikipedia: text(),
  audius: text(),
  zora: text(),
  catalog: text(),
  opensea: text(),
  foundation: text(),
  lastfm: text(),
  linkedin: text(),
  soundxyz: text(),
  mirror: text(),
  glassnode: text(),
  spotifyusername: text(),
  bandcampfan: text(),
  tellie: text(),
  ens: text(),
  lens: text(),
  cameo: text(),
  farcaster: text(),
  supercollector: text(),
  deezer: text(),
  subvert: text(),
  bluesky: text(),
  inprocess: text(),
});

export const users = pgTable("users", {
  id: uuid().primaryKey().notNull(),
  isAdmin: boolean("is_admin").notNull(),
  privyUserId: text("privy_user_id"),
});

/** Platform templates and patterns, one row per platform. */
export const urlmap = pgTable("urlmap", {
  id: uuid().primaryKey().notNull(),
  siteName: text("site_name").notNull(),
  appStringFormat: text("app_string_format").notNull(),
  cardPlatformName: text("card_platform_name"),
  regex: text().notNull(),
  siteImage: text("site_image"),
  colorHex: text("color_hex"),
});

export const artistIdMappings = pgTable("artist_id_mappings", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  platform: text().notNull(),
  platformId: text("platform_id").notNull(),
});

export const artistClaims = pgTable("artist_claims", {
  id: uuid().primaryKey().notNull(),
  userId: uuid("user_id").notNull(),
  artistId: uuid("artist_id").notNull(),
  status: claimStatus().notNull(),
});

export const artistVaultSources = pgTable(
  "artist_vault_sources",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    origin: text().default("unknown").notNull(),
    activityId: uuid("activity_id"),
    url: text().notNull(),
    title: text(),
    snippet: text(),
    type: text(),
    status: sourceStatus().default("pending").notNull(),
    filePath: text("file_path"),
    extractedText: text("extracted_text"),
    ogImage: text("og_image"),
    podcastEpisodeKey: text("podcast_episode_key"),
    podcastShowTitle: text("podcast_show_title"),
    podcastEpisodeTitle: text("podcast_episode_title"),
    publishedAt: date("published_at"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  },
  // The (artist_id, url) unique index is migration 0014 in MusicNerdWeb; declared
  // here so `onConflictDoNothing({ target })` can name it.
  table => [uniqueIndex("artist_vault_sources_artist_url_uniq").on(table.artistId, table.url)],
);

export const artistActivityEvents = pgTable("artist_activity_events", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id").notNull(),
  actorUserId: uuid("actor_user_id"),
  actorKind: text("actor_kind").notNull(),
  action: text().notNull(),
  trigger: text().notNull(),
  sourceId: uuid("source_id"),
  parentActivityId: uuid("parent_activity_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const artistInterviewAnswers = pgTable(
  "artist_interview_answers",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    questionKey: text("question_key").notNull(),
    question: text().notNull(),
    answer: text(),
    source: text().notNull(),
    sitting: integer(),
    offeredAt: timestamp("offered_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  },
  table => [
    unique("artist_interview_answers_artist_question_uniq").on(table.artistId, table.questionKey),
  ],
);

export const artistInterviewAnswerVersions = pgTable(
  "artist_interview_answer_versions",
  {
    answerId: uuid("answer_id").notNull(),
    artistId: uuid("artist_id").notNull(),
    revision: text().notNull(),
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    note: text(),
    actorUserId: uuid("actor_user_id"),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  table => [
    unique("artist_interview_answer_versions_answer_revision").on(table.answerId, table.revision),
  ],
);

export const artistOnboardingSteps = pgTable(
  "artist_onboarding_steps",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    step: text().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }),
  },
  table => [unique("artist_onboarding_steps_artist_step_uniq").on(table.artistId, table.step)],
);

export const artistBioVersions = pgTable("artist_bio_versions", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id").notNull(),
  bioText: text("bio_text").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
});

export const artistDocs = pgTable("artist_docs", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id").notNull().unique("artist_docs_artist_id_key"),
  content: text().notNull(),
  sources: jsonb().default([]).notNull(),
  loreSummary: jsonb("lore_summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});

export const artistDocCorrections = pgTable("artist_doc_corrections", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  claim: text().notNull(),
  correction: text(),
  kind: text().notNull(),
});

export const artistSocialCredits = pgTable("artist_social_credits", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id").notNull(),
  kind: text().notNull(),
  subject: text(),
  isHandle: boolean("is_handle").default(false).notNull(),
  isSelf: boolean("is_self").default(false).notNull(),
  label: text().notNull(),
  quote: text().notNull(),
  sourceUrl: text("source_url").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true, mode: "string" }),
});

export const artistSocialPosts = pgTable("artist_social_posts", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id").notNull(),
  platform: text().notNull(),
  platformPostId: text("platform_post_id").notNull(),
  ownerUsername: text("owner_username").notNull(),
  isOwnPost: boolean("is_own_post").notNull(),
  caption: text(),
  url: text().notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true, mode: "string" }),
  likeCount: integer("like_count"),
  commentCount: integer("comment_count"),
  playCount: integer("play_count"),
  hashtags: text().array().default([]).notNull(),
  mentions: text().array().default([]).notNull(),
  coauthors: text().array().default([]).notNull(),
  musicTitle: text("music_title"),
  musicArtist: text("music_artist"),
  raw: jsonb(),
});

export const artistResearchJobs = pgTable("artist_research_jobs", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  kind: text().notNull(),
  status: text().notNull(),
  cursor: integer().notNull(),
  total: integer(),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }),
  attempts: integer().notNull(),
  lastError: text("last_error"),
  state: jsonb().notNull(),
  activityId: uuid("activity_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

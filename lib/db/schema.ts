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
  uuid,
} from "drizzle-orm/pg-core";

export const claimStatus = pgEnum("claim_status", ["pending", "approved", "rejected"]);
export const sourceStatus = pgEnum("source_status", ["pending", "approved", "rejected"]);

export const artists = pgTable("artists", {
  id: uuid().primaryKey().notNull(),
  name: text(),
  instagram: text(),
  spotify: text(),
  x: text(),
  soundcloud: text(),
  youtube: text(),
});

export const artistClaims = pgTable("artist_claims", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  status: claimStatus().notNull(),
});

export const artistVaultSources = pgTable("artist_vault_sources", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  url: text().notNull(),
  title: text(),
  snippet: text(),
  type: text(),
  status: sourceStatus().notNull(),
  filePath: text("file_path"),
  extractedText: text("extracted_text"),
  publishedAt: date("published_at"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const artistInterviewAnswers = pgTable("artist_interview_answers", {
  id: uuid().primaryKey().notNull(),
  artistId: uuid("artist_id").notNull(),
  question: text().notNull(),
  answer: text(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

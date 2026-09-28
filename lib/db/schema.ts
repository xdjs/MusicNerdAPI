/**
 * The tables this API reads and writes, copied from MusicNerdWeb's
 * `src/server/db/schema.ts`. MusicNerdWeb owns the schema and its migrations;
 * this file declares only the columns this API uses. Keep them in step.
 */
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const artists = pgTable("artists", {
  id: uuid().primaryKey().notNull(),
  name: text(),
  instagram: text(),
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

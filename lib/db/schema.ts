/**
 * The tables this API reads and writes, copied from MusicNerdWeb's
 * `src/server/db/schema.ts`. MusicNerdWeb owns the schema and its migrations;
 * this file declares only the columns this API uses. Keep them in step.
 *
 * Row-level-security policies (`pgPolicy`, `enableRLS`) are left out: they
 * only matter to the migrations, which MusicNerdWeb owns.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformType = pgEnum("platform_type", ["social", "web3", "listen"]);
export const claimStatus = pgEnum("claim_status", ["pending", "approved", "rejected"]);
export const sourceStatus = pgEnum("source_status", ["pending", "approved", "rejected"]);
export const confidenceLevel = pgEnum("confidence_level", ["high", "medium", "low", "manual"]);
export const exclusionReason = pgEnum("exclusion_reason", [
  "conflict",
  "name_mismatch",
  "too_ambiguous",
]);

export const funfacts = pgTable("funfacts", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity({
    name: "funfacts_id_seq",
    startWith: 1,
    increment: 1,
    minValue: 1,
    maxValue: 9223372036854775807,
    cache: 1,
  }),
  loreDrop: text("lore_drop"),
  behindTheScenes: text("behind_the_scenes"),
  recentActivity: text("recent_activity"),
  surpriseMe: text("surprise_me").notNull(),
  isActive: boolean("is_active").default(false),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    email: text("email"),
    username: text("username"),
    usernameNeedsConfirmation: boolean("username_needs_confirmation").default(false).notNull(),
    usernamePromptedAt: timestamp("username_prompted_at", { withTimezone: true, mode: "string" }),
    wallet: text("wallet"), // Nullable for Privy users who haven't linked a wallet
    privyUserId: text("privy_user_id"), // Privy authentication identifier
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    legacyId: text("legacy_id"),
    isAdmin: boolean("is_admin").default(false).notNull(),
    isWhiteListed: boolean("is_white_listed").default(false).notNull(),
    isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
    isHidden: boolean("is_hidden").default(false).notNull(),
    legacyLinkDismissed: boolean("legacy_link_dismissed").default(false).notNull(),
    acceptedUgcCount: bigint("accepted_ugc_count", { mode: "number" }),
  },
  table => [
    uniqueIndex("users_public_username_unique")
      .on(sql`lower(btrim(${table.username}))`)
      .where(
        sql`nullif(btrim(${table.username}), '') is not null and ${table.username} !~ '[^[:space:]@]+@[^[:space:]@]+' and lower(btrim(${table.username})) is distinct from lower(btrim(${table.wallet}))`,
      ),
    unique("users_wallet_key").on(table.wallet),
    unique("users_privy_user_id_key").on(table.privyUserId),
  ],
);

/**
 * The artist row with every link column, since link writes and the identity
 * gates read them by name, plus the profile columns the migrated routes touch.
 * Deliberately not the whole row: that lives in `lib/artistLookups/lookupArtists.ts`.
 */
export const artists = pgTable(
  "artists",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    legacyId: text("legacy_id"),
    name: text(),
    lcname: text("lcname"),
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
    addedBy: uuid("added_by"),
    cameo: text(),
    farcaster: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    supercollector: text(),
    customImage: text("custom_image"),
    headerImagePosition: jsonb("header_image_position").$type<{ imageUrl: string; y: number }>(),
    // MusicNerdWeb's `ArtistLinkOrder` (`src/lib/artist/artistProfileLinks.ts`).
    linkOrder: jsonb("link_order").$type<Partial<Record<"links" | "support", string[]>>>(),
    deezer: text(),
    subvert: text(),
    bluesky: text(),
    inprocess: text(),
  },
  table => [
    index("artists_added_by_created_at_idx").using(
      "btree",
      table.addedBy.asc().nullsLast().op("timestamptz_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("artists_lcname_btree_idx").using("btree", table.lcname.asc().nullsLast().op("text_ops")),
    index("artists_lcname_trgm_gin").using(
      "gin",
      table.lcname.asc().nullsLast().op("gin_trgm_ops"),
    ),
    index("artists_lcname_trgm_idx").using(
      "gist",
      table.lcname.asc().nullsLast().op("gist_trgm_ops"),
    ),
    index("artists_name_trgm_idx").using("gist", table.name.asc().nullsLast().op("gist_trgm_ops")),
    uniqueIndex("artists_spotify_uniq")
      .using("btree", table.spotify.asc().nullsLast().op("text_ops"))
      .where(sql`(spotify IS NOT NULL)`),
    uniqueIndex("artists_deezer_uniq")
      .using("btree", table.deezer.asc().nullsLast().op("text_ops"))
      .where(sql`(deezer IS NOT NULL)`),
    index("artists_music_bandcamp_owner_idx").on(sql`lower(ltrim(btrim(${table.bandcamp}), '@'))`),
    index("artists_music_subvert_owner_idx").on(sql`lower(ltrim(btrim(${table.subvert}), '@'))`),
    index("artists_music_supercollector_owner_idx").on(
      sql`regexp_replace(lower(ltrim(btrim(${table.supercollector}), '@')), '[.]eth$', '')`,
    ),
    index("artists_music_soundcloud_owner_idx").on(
      sql`lower(ltrim(btrim(${table.soundcloud}), '@'))`,
    ),
    index("artists_music_audius_owner_idx").on(sql`lower(ltrim(btrim(${table.audius}), '@'))`),
    index("artists_music_mixcloud_owner_idx").on(sql`lower(ltrim(btrim(${table.mixcloud}), '@'))`),
    index("idx_artists_added_by").using("btree", table.addedBy.asc().nullsLast().op("uuid_ops")),
    index("idx_artists_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
    index("idx_artists_name_gin").using("gin", sql`to_tsvector('english'::regconfig, name)`),
    index("idx_artists_created_at").using("btree", table.createdAt.desc().nullsLast()),
    foreignKey({
      columns: [table.addedBy],
      foreignColumns: [users.id],
      name: "artists_added_by_fkey",
    }),
  ],
);

export const ugcresearch = pgTable(
  "ugcresearch",
  {
    origin: text("origin").default("unknown").notNull(),
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
    artistUri: text("artist_uri"),
    accepted: boolean("accepted").default(false),
    ugcUrl: text("ugc_url"),
    siteName: text("site_name"),
    siteUsername: text("site_username"),
    artistId: uuid("artist_id"),
    dateProcessed: timestamp("date_processed", { mode: "string" }),
    name: text("name"),
    userId: uuid("user_id"),
  },
  table => [
    index("idx_ugcresearch_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
    index("ugcresearch_user_created_at_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("idx_ugcresearch_date_processed").using("btree", table.dateProcessed.desc().nullsLast()),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "ugcresearch_artist_id_fkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "ugcresearch_user_id_fkey",
    }),
  ],
);

/** Platform templates and patterns, one row per platform. */
export const urlmap = pgTable(
  "urlmap",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    siteUrl: text("site_url").notNull(),
    siteName: text("site_name").notNull(),
    example: text("example").notNull(),
    appStringFormat: text("app_string_format").notNull(),
    order: integer("order"),
    isIframeEnabled: boolean("is_iframe_enabled").default(false).notNull(),
    isEmbedEnabled: boolean("is_embed_enabled").default(false).notNull(),
    cardDescription: text("card_description"),
    cardPlatformName: text("card_platform_name"),
    isWeb3Site: boolean("is_web3_site").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).default(
      sql`(now() AT TIME ZONE 'utc'::text)`,
    ),
    siteImage: text("site_image"),
    regex: text("regex").default('""').notNull(),
    regexMatcher: text("regex_matcher"),
    isMonetized: boolean("is_monetized").default(false).notNull(),
    regexOptions: text("regex_options").array(),
    colorHex: text("color_hex").default("#000000"),
    platformTypeList: platformType("platform_type_list").array().default(["social"]),
  },
  table => [
    unique("urlmap_siteurl_key").on(table.siteUrl),
    unique("urlmap_sitename_key").on(table.siteName),
    unique("urlmap_example_key").on(table.example),
    unique("urlmap_appstringformat_key").on(table.appStringFormat),
  ],
);

export const mcpApiKeys = pgTable("mcp_api_keys", {
  id: uuid("id")
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .default(sql`now()`)
    .notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
});

// Append-only audit log — no UPDATE or DELETE policies granted to application role.
export const mcpAuditLog = pgTable(
  "mcp_audit_log",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    field: text("field").notNull(),
    action: text("action").notNull(),
    submittedUrl: text("submitted_url"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    apiKeyHash: text("api_key_hash").notNull(), // Intentionally not a FK — audit records survive key deletion
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
  },
  table => [
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "mcp_audit_log_artist_id_fkey",
    }),
    index("idx_mcp_audit_log_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_mcp_audit_log_created_at").using("btree", table.createdAt.desc().nullsLast()),
    index("idx_mcp_audit_log_api_key_hash_created_at").using(
      "btree",
      table.apiKeyHash.asc().nullsLast(),
      table.createdAt.desc().nullsLast(),
    ),
  ],
);

export const artistIdMappings = pgTable(
  "artist_id_mappings",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    platform: text("platform").notNull(),
    platformId: text("platform_id").notNull(),
    confidence: confidenceLevel("confidence").notNull(),
    source: text("source").notNull(),
    reasoning: text("reasoning"),
    apiKeyHash: text("api_key_hash"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
  },
  table => [
    unique("artist_id_mappings_artist_platform_uniq").on(table.artistId, table.platform),
    unique("artist_id_mappings_platform_id_uniq").on(table.platform, table.platformId),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_id_mappings_artist_id_fkey",
    }),
    index("idx_artist_id_mappings_platform_artist").using(
      "btree",
      table.platform.asc().nullsLast(),
      table.artistId.asc().nullsLast(),
    ),
    index("idx_artist_id_mappings_confidence").using("btree", table.confidence.asc().nullsLast()),
  ],
);

export const artistMappingExclusions = pgTable(
  "artist_mapping_exclusions",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    platform: text("platform").notNull(),
    reason: exclusionReason("reason").notNull(),
    details: text("details"),
    apiKeyHash: text("api_key_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
  },
  table => [
    unique("artist_mapping_exclusions_artist_platform_uniq").on(table.artistId, table.platform),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_mapping_exclusions_artist_id_fkey",
    }).onDelete("cascade"),
    index("idx_artist_mapping_exclusions_platform").using(
      "btree",
      table.platform.asc().nullsLast(),
    ),
  ],
);

export const agentHeartbeats = pgTable(
  "agent_heartbeats",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    workerId: text("worker_id").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    status: text("status").default("starting").notNull(),
    currentRun: integer("current_run"),
    batchPlatform: text("batch_platform"),
    batchSize: integer("batch_size"),
    message: text("message"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    config: jsonb("config").$type<Record<string, unknown>>(),
  },
  table => [
    unique("agent_heartbeats_worker_id_key").on(table.workerId),
    index("idx_agent_heartbeats_updated_at").using("btree", table.updatedAt.desc().nullsLast()),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    workerId: text("worker_id").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    runNumber: integer("run_number").notNull(),
    platform: text("platform").default("deezer").notNull(),
    status: text("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    wallTimeSecs: integer("wall_time_secs"),
    claudeTimeSecs: integer("claude_time_secs"),
    apiTimeSecs: integer("api_time_secs"),
    turns: integer("turns"),
    batchSize: integer("batch_size"),
    resolved: integer("resolved").default(0),
    excluded: integer("excluded").default(0),
    skipped: integer("skipped").default(0),
    errors: integer("errors").default(0),
    highConfidence: integer("high_confidence").default(0),
    mediumConfidence: integer("medium_confidence").default(0),
    conflicts: integer("conflicts").default(0),
    nameMismatches: integer("name_mismatches").default(0),
    tooAmbiguous: integer("too_ambiguous").default(0),
    exitCode: integer("exit_code"),
    failCategory: text("fail_category"),
    failReason: text("fail_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`now()`)
      .notNull(),
  },
  table => [
    uniqueIndex("idx_agent_runs_worker_run").using(
      "btree",
      table.workerId.asc().nullsLast(),
      table.runNumber.asc().nullsLast(),
    ),
    index("idx_agent_runs_started_at").using("btree", table.startedAt.desc().nullsLast()),
  ],
);

export const artistClaims = pgTable(
  "artist_claims",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    userId: uuid("user_id").notNull(),
    artistId: uuid("artist_id").notNull(),
    status: claimStatus().default("pending").notNull(),
    // Web also has reference_code, created_at and updated_at; no migrated route reads them.
  },
  table => [
    // Partial unique index: only one active (pending or approved) claim per artist at a time.
    // Rejected claims are preserved for audit history (and may coexist freely).
    uniqueIndex("artist_claims_artist_id_active_uniq")
      .using("btree", table.artistId.asc().nullsLast().op("uuid_ops"))
      .where(sql`status IN ('pending', 'approved')`),
    index("idx_artist_claims_user_id").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_artist_claims_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "artist_claims_user_id_fkey",
    }),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_claims_artist_id_fkey",
    }),
  ],
);

export const artistActivityEvents = pgTable(
  "artist_activity_events",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorKind: text("actor_kind").notNull(),
    action: text().notNull(),
    trigger: text().notNull(),
    // IDs are retained after source/job deletion; no private payload snapshots.
    sourceId: uuid("source_id"),
    parentActivityId: uuid("parent_activity_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  table => [
    check("artist_activity_actor_kind", sql`${table.actorKind} in ('user', 'system', 'unknown')`),
    index("artist_activity_created_at").on(table.createdAt.desc(), table.id),
    index("artist_activity_artist_created_at").on(table.artistId, table.createdAt.desc()),
    index("artist_activity_actor_created_at").on(table.actorUserId, table.createdAt.desc()),
  ],
);

export const artistVaultSources = pgTable(
  "artist_vault_sources",
  {
    origin: text().default("unknown").notNull(),
    activityId: uuid("activity_id").references(() => artistActivityEvents.id, {
      onDelete: "set null",
    }),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    url: text().notNull(),
    title: text(),
    snippet: text(),
    type: text(),
    status: sourceStatus().default("pending").notNull(),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    filePath: text("file_path"),
    contentType: text("content_type"),
    extractedText: text("extracted_text"),
    ogImage: text("og_image"),
    // Verified recording identity captured during ingestion. Nullable when provider
    // metadata is absent or ambiguous; never guessed from an episode title.
    podcastEpisodeKey: text("podcast_episode_key"),
    podcastShowTitle: text("podcast_show_title"),
    podcastEpisodeTitle: text("podcast_episode_title"),
    // When the SOURCE says it was published — not when we scraped it. Nullable:
    // many pages never say, and a guessed date is worse than none, because it
    // would let the knowledge doc confidently scope a claim to the wrong era.
    // See migration 0015.
    publishedAt: date("published_at"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    // MusicNerdWeb declares this NOT NULL with a default; kept nullable here because
    // `lib/knowledge/normalizeKnowledgeSourceSnapshot` decodes stored snapshots that may lack it.
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  },
  table => [
    index("idx_artist_vault_sources_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_vault_sources_artist_id_fkey",
    }).onDelete("cascade"),
    // The (artist_id, url) unique index is migration 0014 in MusicNerdWeb; declared
    // here so `onConflictDoNothing({ target })` can name it.
    uniqueIndex("artist_vault_sources_artist_url_uniq").on(table.artistId, table.url),
  ],
);

// Raw interview answers — the artist's own words, never lost to doc regeneration.
// answer NULL = explicitly skipped (counts as asked; returns to the follow-up bank).
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
    /** Which sitting this question was offered in. Nullable for rows that
     *  predate 0022; a null reads as 1, which is what every such row is. */
    sitting: integer(),
    /** When this question was put to the artist. Unlike `createdAt`, this does
     *  not move when the answer arrives; it is the material cutoff for the
     *  sitting. */
    // MusicNerdWeb declares both NOT NULL with a default; kept nullable here because
    // `lib/interviewResponses/loadInterviewResponseVersions` decodes stored snapshots that may lack them.
    offeredAt: timestamp("offered_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  },
  table => [
    unique("artist_interview_answers_artist_question_uniq").on(table.artistId, table.questionKey),
    index("idx_artist_interview_answers_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_interview_answers_artist_id_fkey",
    }).onDelete("cascade"),
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

/** Private preparation, never interview testimony. Claim changes invalidate the saved plan. */
export const artistOnboardingSteps = pgTable(
  "artist_onboarding_steps",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    step: text().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    unique("artist_onboarding_steps_artist_step_uniq").on(table.artistId, table.step),
    index("idx_artist_onboarding_steps_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_onboarding_steps_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const artistBioVersions = pgTable(
  "artist_bio_versions",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    bioText: text("bio_text").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    index("idx_artist_bio_versions_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_bio_versions_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

// Post-claim onboarding: the artist knowledgebase doc (one current doc per artist).
export const artistDocs = pgTable(
  "artist_docs",
  {
    loreSummary: jsonb("lore_summary"),
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    content: text().notNull(),
    // The numbered citation source list synthesizeArtistDoc built for this content's
    // [n] markers — DocSource[] (id/kind/label/url), see artistDocService.ts. Defaults
    // to an empty array so pre-citation-era rows (and any row inserted without an
    // explicit value) read back as [] rather than null.
    sources: jsonb().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    unique("artist_docs_artist_id_key").on(table.artistId),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_docs_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * What the artist has told us directly, which outranks anything we read.
 *
 * The knowledge document is regenerated whenever their sources change, so a
 * correction typed into the document would be destroyed the next time they
 * added one. These live outside it and are re-injected into every rebuild —
 * the same durability the source rejections already have.
 */
export const artistDocCorrections = pgTable(
  "artist_doc_corrections",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    /** The claim as it appeared. Keyed by TEXT, not position: a rebuild reorders
     *  and renumbers everything, but the wording largely survives. */
    claim: text().notNull(),
    /** The artist's replacement. Null for `kind: 'wrong'`. */
    correction: text(),
    /** 'wrong' — not true / not them. 'fix' — replaced with their own wording. */
    kind: text().default("wrong").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    index("idx_artist_doc_corrections_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("artist_doc_corrections_artist_claim_uniq").on(table.artistId, table.claim),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_doc_corrections_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const artistSocialCredits = pgTable(
  "artist_social_credits",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    artistId: uuid("artist_id").notNull(),
    platform: text("platform").default("instagram").notNull(),
    /** 'credit' = a person given a role; 'statement' = the artist on their own work. */
    kind: text().notNull(),
    subject: text(),
    isHandle: boolean("is_handle").default(false).notNull(),
    /** The artist crediting themselves. Keep the fact, never draw the edge. */
    isSelf: boolean("is_self").default(false).notNull(),
    label: text().notNull(),
    quote: text().notNull(),
    sourceUrl: text("source_url").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    index("idx_artist_social_credits_artist").using(
      "btree",
      table.artistId.asc().nullsLast(),
      table.kind.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_social_credits_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const artistSocialPosts = pgTable(
  "artist_social_posts",
  {
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`(now() AT TIME ZONE 'utc'::text)`)
      .notNull(),
  },
  table => [
    unique("artist_social_posts_artist_platform_post_uniq").on(
      table.artistId,
      table.platform,
      table.platformPostId,
    ),
    index("idx_artist_social_posts_artist_id").using(
      "btree",
      table.artistId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_artist_social_posts_own").using(
      "btree",
      table.artistId.asc().nullsLast(),
      table.isOwnPost.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.artistId],
      foreignColumns: [artists.id],
      name: "artist_social_posts_artist_id_fkey",
    }).onDelete("cascade"),
  ],
);

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

/** Explicit API interview sittings; profile reads never create one. */
export const artistInterviewSessions = pgTable("artist_interview_sessions", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artists.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull(),
  sitting: integer().notNull(),
  state: text().default("active").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }),
});

/** Private immutable original references for a question; not a public activity payload. */
export const artistInterviewQuestionEvidence = pgTable("artist_interview_question_evidence", {
  answerId: uuid("answer_id")
    .primaryKey()
    .references(() => artistInterviewAnswers.id, { onDelete: "cascade" }),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artists.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull(),
  ordinal: integer().notNull(),
  memorySnapshotId: text("memory_snapshot_id").notNull(),
  evidenceReferences: jsonb("evidence_references").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

/** Current bounded public provider snapshots; MusicNerdWeb migration 0045 owns storage. */
export const artistLatestProviderSnapshots = pgTable(
  "artist_latest_provider_snapshots",
  {
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    accountId: text("account_id").notNull(),
    items: jsonb().notNull().default([]),
    checkedAt: timestamp("checked_at", { withTimezone: true, mode: "string" }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    status: text().notNull(),
  },
  table => [primaryKey({ columns: [table.artistId, table.provider] })],
);

// Self-maintenance is activity, never a credited UGC contribution.
export const artistSelfEdits = pgTable(
  "artist_self_edits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteName: text("site_name").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value").notNull(),
    submittedUrl: text("submitted_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  table => [
    index("artist_self_edits_user_time_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("artist_self_edits_time_idx").on(table.createdAt.desc()),
    check("artist_self_edits_changed", sql`${table.oldValue} IS DISTINCT FROM ${table.newValue}`),
    check("artist_self_edits_nonempty", sql`length(${table.newValue}) > 0`),
  ],
);

export const userArtistBookmarks = pgTable(
  "user_artist_bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  table => [
    primaryKey({ name: "user_artist_bookmarks_pkey", columns: [table.userId, table.artistId] }),
    index("user_artist_bookmarks_user_order_idx").on(table.userId, table.position),
    index("user_artist_bookmarks_artist_idx").on(table.artistId),
    check("user_artist_bookmarks_position_nonnegative", sql`${table.position} >= 0`),
  ],
);

// Prospective original retention. The writer's transaction captures old eligible
// evidence; API authorization and current parent eligibility govern every read.
export const artistBioCorrections = pgTable(
  "artist_bio_corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    sourceUrl: text("source_url"),
    bioSnapshot: text("bio_snapshot").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  table => [
    index("artist_bio_corrections_user_created").on(table.userId, table.createdAt),
    index("artist_bio_corrections_status_created").on(table.status, table.createdAt),
    check(
      "artist_bio_corrections_reason",
      sql`${table.reason} in ('wrong_artist','incorrect','outdated','other')`,
    ),
    check(
      "artist_bio_corrections_status",
      sql`${table.status} in ('pending','resolved','dismissed')`,
    ),
    check(
      "artist_bio_corrections_bounds",
      sql`length(${table.details}) <= 2000 and length(${table.bioSnapshot}) between 1 and 12000 and (${table.sourceUrl} is null or length(${table.sourceUrl}) <= 2048)`,
    ),
    check(
      "artist_bio_corrections_review",
      sql`(${table.status} = 'pending' and ${table.reviewedAt} is null and ${table.reviewedBy} is null) or (${table.status} <> 'pending' and ${table.reviewedAt} is not null and ${table.reviewedBy} is not null)`,
    ),
  ],
);

// Relations, only where a migrated route reads with `db.query.<table>` and `with:`:
// `getApprovedClaimByUserId` (user/has-claim) and `getPendingUGC` (pendingUGCCount).
export const ugcresearchRelations = relations(ugcresearch, ({ one }) => ({
  artist: one(artists, {
    fields: [ugcresearch.artistId],
    references: [artists.id],
  }),
  user: one(users, {
    fields: [ugcresearch.userId],
    references: [users.id],
  }),
}));

export const artistClaimsRelations = relations(artistClaims, ({ one }) => ({
  user: one(users, {
    fields: [artistClaims.userId],
    references: [users.id],
  }),
  artist: one(artists, {
    fields: [artistClaims.artistId],
    references: [artists.id],
  }),
}));

/** The Discord role pinged when user-submitted links await review. */
export const UGC_REVIEWER_ROLE_ID = "1091088804028362944";

/** The `ugcresearch.site_name` of the one row whose `created_at` is the last review ping. */
export const UGC_PING_SENTINEL_SITE_NAME = "ugc_discord_ping";

/** At most one review ping per this many milliseconds (MusicNerdWeb's 15 minute default). */
export const UGC_PING_COOLDOWN_MS = 900 * 1000;

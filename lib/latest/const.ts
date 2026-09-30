/** A Latest check reads the artist's last thirty days of posts. */
export const LATEST_WINDOW_MS = 30 * 86_400_000;
/** At most nine posts: their thumbnails fit in one slice. */
export const LATEST_POST_LIMIT = 9;
/** The Apify spend cap for one Latest check. */
export const LATEST_MAX_CHARGE_USD = 0.03;
/** Collecting the posts and their thumbnails needs this much of a slice. */
export const LATEST_COLLECT_RESERVE_MS = 45_000;

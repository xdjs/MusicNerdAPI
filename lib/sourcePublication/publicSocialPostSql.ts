import { sql } from "drizzle-orm";

/** A social post the public corpus may read: the artist's own post, neither a repost nor a retweet. */
export function publicSocialPostSql(alias = "s") {
  const a = sql.raw(alias);
  return sql`(${a}.is_own_post = true and ${a}.raw->'isRepost' is distinct from 'true'::jsonb and ${a}.raw->'isRetweet' is distinct from 'true'::jsonb)`;
}

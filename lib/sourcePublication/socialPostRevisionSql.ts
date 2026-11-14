import { sql } from "drizzle-orm";

/** The social post revision: the 0039 fingerprint the knowledge versions trigger stamps on the post's snapshot. */
export function socialPostRevisionSql(alias = "s") {
  const a = sql.raw(alias);
  return sql`public.knowledge_source_fingerprint(public.knowledge_social_post_snapshot(${a}))`;
}

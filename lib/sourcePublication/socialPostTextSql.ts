import { sql } from "drizzle-orm";

/**
 * A social post's text as its units are cut from it: the caption, then the Instagram reel
 * transcript after a blank line when the stored transcript passes the public corpus's guard
 * (version 1, from the reel scraper, a non-blank string). The transcript is appended untrimmed.
 */
export function socialPostTextSql(alias = "s") {
  const a = sql.raw(alias);
  return sql`(case when ${a}.platform = 'instagram' and ${a}.raw->'_musicnerdTranscript'->'version' = '1'::jsonb and ${a}.raw->'_musicnerdTranscript'->>'actor' = 'apify/instagram-reel-scraper' and jsonb_typeof(${a}.raw->'_musicnerdTranscript'->'text') = 'string' and btrim(${a}.raw->'_musicnerdTranscript'->>'text') <> '' then coalesce(nullif(${a}.caption, '') || E'\\n\\n', '') || (${a}.raw->'_musicnerdTranscript'->>'text') else coalesce(${a}.caption, '') end)`;
}

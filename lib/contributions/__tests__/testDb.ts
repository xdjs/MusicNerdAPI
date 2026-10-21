import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

/** Staging-style fixture ids: an artist, a second artist and two users. */
export const ids = {
  artist: "00000000-0000-4000-8000-000000000001",
  otherArtist: "00000000-0000-4000-8000-000000000002",
  user: "00000000-0000-4000-8000-000000000010",
  otherUser: "00000000-0000-4000-8000-000000000011",
};

/**
 * An in-memory Postgres with the tables the feed and contribution queries read,
 * named as in MusicNerdWeb's schema, so the real Drizzle queries run unchanged.
 * Tests mock `@/lib/db/db` with `database`.
 */
export async function createTestDb() {
  const client = new PGlite();
  const database = drizzle(client, { schema });
  // Supabase runs in UTC; the feed's UNION mixes timestamp and timestamptz columns.
  await client.exec(`
set time zone 'UTC';
create table artists(id uuid primary key,name text,spotify text,deezer text,custom_image text,created_at timestamptz default now());
create table ugcresearch(id uuid primary key default gen_random_uuid(),origin text default 'unknown',created_at timestamp default now(),updated_at timestamp default now(),artist_uri text,accepted boolean default false,ugc_url text,site_name text,site_username text,artist_id uuid,date_processed timestamp,name text,user_id uuid);
create table artist_self_edits(id uuid primary key default gen_random_uuid(),artist_id uuid not null,user_id uuid not null,site_name text not null,old_value text,new_value text not null,submitted_url text not null,created_at timestamptz default clock_timestamp() not null);
create table mcp_audit_log(id uuid primary key default gen_random_uuid(),artist_id uuid not null,field text not null,action text not null,submitted_url text,old_value text,new_value text,api_key_hash text not null,created_at timestamptz default now() not null);
insert into artists(id,name,spotify,deezer,custom_image,created_at) values
 ('${ids.artist}','Bio Ritmo','3pZWMMjXnxbcxurOCYK5sL',null,null,'2026-10-01T00:00:00Z'),
 ('${ids.otherArtist}','Celia Cruz',null,'1234',' https://example.org/celia.jpg ','2026-10-02T00:00:00Z');`);
  return { client, database };
}

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

/** Fixture ids: two artists, a contributor, a second user and an admin. */
export const ids = {
  artist: "00000000-0000-4000-8000-000000000001",
  otherArtist: "00000000-0000-4000-8000-000000000002",
  user: "00000000-0000-4000-8000-000000000010",
  otherUser: "00000000-0000-4000-8000-000000000011",
  admin: "00000000-0000-4000-8000-000000000012",
};

/**
 * An in-memory Postgres with the tables the admin and editor reads join, named
 * and typed as on staging: `users` (every column), `artists`, `ugcresearch`,
 * `artist_vault_sources` (every column), `artist_activity_events`,
 * `artist_bio_corrections` and `artist_claims`. Seeds two artists and three
 * users; tests seed the rest. Tests mock `@/lib/db/db` with `db`.
 *
 * @returns The PGlite client (to seed and close) and a Drizzle instance over it.
 */
export async function createAdminReadsDatabase() {
  const client = new PGlite();
  await client.exec(`
    set time zone 'UTC';
    create type claim_status as enum ('pending','approved','rejected');
    create type source_status as enum ('pending','approved','rejected');
    create table users(
      id uuid primary key default gen_random_uuid(),
      email text, username text,
      username_needs_confirmation boolean not null default false,
      username_prompted_at timestamptz, wallet text, privy_user_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      legacy_id text,
      is_admin boolean not null default false,
      is_white_listed boolean not null default false,
      is_super_admin boolean not null default false,
      is_hidden boolean not null default false,
      legacy_link_dismissed boolean not null default false,
      accepted_ugc_count bigint
    );
    create table artists(id uuid primary key, name text, bio text, instagram text, added_by uuid,
      created_at timestamptz default now());
    create table ugcresearch(id uuid primary key default gen_random_uuid(), origin text default 'unknown',
      created_at timestamp default now(), accepted boolean default false, ugc_url text, site_name text,
      artist_id uuid, date_processed timestamp, name text, user_id uuid);
    create table artist_activity_events(id uuid primary key default gen_random_uuid(),
      artist_id uuid not null, actor_user_id uuid, actor_kind text not null, action text not null,
      trigger text not null, source_id uuid, parent_activity_id uuid,
      created_at timestamptz not null default now());
    create table artist_vault_sources(origin text not null default 'unknown', activity_id uuid,
      id uuid primary key default gen_random_uuid(), artist_id uuid not null, url text not null,
      title text, snippet text, type text, status source_status not null default 'pending',
      file_name text, file_size integer, file_path text, content_type text, extracted_text text,
      og_image text, podcast_episode_key text, podcast_show_title text, podcast_episode_title text,
      published_at date, created_at timestamptz not null default now(), updated_at timestamptz);
    create table artist_bio_corrections(id uuid primary key default gen_random_uuid(),
      artist_id uuid not null, user_id uuid, reason text, details text, source_url text,
      bio_snapshot text, status text not null default 'pending',
      created_at timestamptz not null default now());
    create table artist_claims(id uuid primary key default gen_random_uuid(), user_id uuid not null,
      artist_id uuid not null, status claim_status not null default 'pending', reference_code text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    insert into artists(id, name, bio, instagram, added_by, created_at) values
      ('${ids.artist}', 'Bio Ritmo', 'Salsa from Richmond.', 'bioritmo', '${ids.user}', '2026-10-01T00:00:00Z'),
      ('${ids.otherArtist}', 'Celia Cruz', null, null, null, '2026-10-02T00:00:00Z');
    insert into users(id, email, username, wallet, is_admin, is_white_listed, is_hidden, updated_at) values
      ('${ids.user}', 'fan@example.com', 'salsero', null, false, true, false, '2026-10-20T00:00:00Z'),
      ('${ids.otherUser}', null, 'hidden_fan', '0xabc', false, false, true, '2026-10-21T00:00:00Z'),
      ('${ids.admin}', 'admin@example.com', 'admin', null, true, false, false, '2026-10-22T00:00:00Z');
  `);
  return { client, db: drizzle(client, { schema }) };
}

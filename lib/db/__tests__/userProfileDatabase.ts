import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

/**
 * An in-memory Postgres with the tables the user and profile queries read:
 * `users` (every column, with its public-name unique index), `artists`,
 * `ugcresearch`, `artist_self_edits` and `artist_claims` (the columns used).
 * Tests mock `@/lib/db/db` with the returned `db` so the real queries run.
 *
 * @returns The PGlite client (to seed and close) and a Drizzle instance over it.
 */
export async function createUserProfileDatabase() {
  const client = new PGlite();
  await client.exec(`
    create table users(
      id uuid primary key default gen_random_uuid(),
      email text,
      username text,
      username_needs_confirmation boolean not null default false,
      username_prompted_at timestamptz,
      wallet text,
      privy_user_id text,
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
    create unique index users_public_username_unique on users (lower(btrim(username)))
      where nullif(btrim(username), '') is not null
      and username !~ '[^[:space:]@]+@[^[:space:]@]+'
      and lower(btrim(username)) is distinct from lower(btrim(wallet));
    create table artists(
      id uuid primary key default gen_random_uuid(),
      name text,
      bio text,
      added_by uuid,
      custom_image text
    );
    create table ugcresearch(
      id uuid primary key default gen_random_uuid(),
      created_at timestamp default now(),
      artist_id uuid,
      user_id uuid,
      accepted boolean default false,
      ugc_url text,
      site_name text
    );
    create table artist_self_edits(
      id uuid primary key default gen_random_uuid(),
      artist_id uuid not null,
      user_id uuid not null,
      site_name text not null default 'spotify',
      new_value text not null default 'x',
      submitted_url text not null default 'https://example.com',
      created_at timestamptz not null default now()
    );
    create table artist_claims(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      artist_id uuid not null,
      status text not null default 'pending',
      reference_code text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  return { client, db: drizzle(client, { schema }) };
}

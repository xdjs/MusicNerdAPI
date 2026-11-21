import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";

/**
 * An in-memory Postgres with `users` (the columns OAuth reads) and the three
 * OAuth tables exactly as MusicNerdWeb's migration 0067 creates them, checks,
 * cascades and all. Tests mock `@/lib/db/db` with the returned `db`.
 *
 * @returns The PGlite client (to seed and close) and a Drizzle instance over it.
 */
export async function createOAuthDatabase() {
  const client = new PGlite();
  await client.exec(`
    create table users(
      id uuid primary key default gen_random_uuid(),
      email text,
      privy_user_id text,
      is_admin boolean not null default false
    );
    create table oauth_clients(
      id uuid primary key default gen_random_uuid() not null,
      name text not null,
      redirect_uris text[] not null,
      created_at timestamptz default now() not null,
      constraint oauth_clients_name check (char_length(name) between 1 and 200)
    );
    create table oauth_grants(
      id uuid primary key default gen_random_uuid() not null,
      client_id uuid not null references oauth_clients(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      created_at timestamptz default now() not null,
      last_used_at timestamptz
    );
    create table oauth_tokens(
      hash text primary key not null,
      kind text not null,
      grant_id uuid not null references oauth_grants(id) on delete cascade,
      expires_at timestamptz,
      used_at timestamptz,
      code_challenge text,
      redirect_uri text,
      created_at timestamptz default now() not null,
      constraint oauth_tokens_hash check (hash ~ '^[0-9a-f]{64}$'),
      constraint oauth_tokens_kind check (kind in ('code','access','refresh')),
      constraint oauth_tokens_expiry check ((kind = 'refresh') = (expires_at is null)),
      constraint oauth_tokens_code check ((kind = 'code') = (code_challenge is not null and redirect_uri is not null))
    );
  `);
  return { client, db: drizzle(client, { schema }) };
}

/**
 * Seeds a user, a client and a grant between them.
 *
 * @param client - The PGlite client.
 * @param user - The user's email and admin flag.
 * @param user.email - The user's email.
 * @param user.isAdmin - Whether the user is an admin.
 * @returns The ids.
 */
export async function seedGrant(
  client: PGlite,
  user: { email?: string | null; isAdmin?: boolean } = {},
) {
  const {
    rows: [u],
  } = await client.query<{ id: string }>(
    "insert into users(email, is_admin) values($1, $2) returning id",
    [user.email ?? null, user.isAdmin ?? false],
  );
  const {
    rows: [c],
  } = await client.query<{ id: string }>(
    "insert into oauth_clients(name, redirect_uris) values('Claude', array['http://127.0.0.1:33418/callback']) returning id",
  );
  const {
    rows: [g],
  } = await client.query<{ id: string }>(
    "insert into oauth_grants(client_id, user_id) values($1, $2) returning id",
    [c.id, u.id],
  );
  return { userId: u.id, clientId: c.id, grantId: g.id };
}

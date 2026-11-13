/**
 * The tables the unit eligibility predicate and the unit readers use, reduced to the columns they
 * reference, for PGlite. PGlite has no pgvector, so `extensions.vector` is a text domain and `embedding` is text;
 * `search` is the real generated column of migration 0066. The two knowledge functions are stubs
 * that still change when the post changes, which is all the revision check needs.
 */
export const UNIT_SEARCH_SCHEMA = `
  create schema extensions;
  create domain extensions.vector as text;
  create table artists(id uuid primary key, instagram text);
  create table artist_claims(artist_id uuid, status text);
  create table artist_activity_events(id uuid, artist_id uuid, source_id uuid, actor_kind text, actor_user_id text, trigger text, action text);
  create table artist_vault_sources(
    id uuid primary key, artist_id uuid, activity_id uuid, origin text, status text,
    publication text not null default 'inherit', url text, title text, file_name text, file_path text, content_type text,
    extracted_text text, updated_at timestamptz, created_at timestamptz default '2026-01-02T00:00:00Z'
  );
  create table artist_social_posts(id uuid primary key, artist_id uuid, platform text, caption text, url text, is_own_post boolean, raw jsonb);
  create table artist_research_candidates(
    id uuid primary key, artist_id uuid, current_revision text, identity text, curation text,
    reviewed_revision text, destination text, source_id uuid, platform text, platform_id text, url text
  );
  create table artist_research_evidence(id uuid primary key, candidate_id uuid, artist_id uuid, revision text, title text, original_text text);
  create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select to_jsonb(s)';
  create function knowledge_source_fingerprint(j jsonb) returns text language sql as 'select ''fp:'' || md5(j::text)';
  create table source_units(
    id uuid primary key default gen_random_uuid(),
    source_kind text not null, source_id uuid not null, artist_id uuid not null,
    source_revision text not null, unit_index integer not null, locator text not null,
    title text, url text, text text not null, text_hash text not null default 'h', tokens integer not null default 1,
    ocr boolean not null default false, ingest_version integer not null default 1, embedding text,
    search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || text)) stored,
    created_at timestamptz not null default now()
  );
`;

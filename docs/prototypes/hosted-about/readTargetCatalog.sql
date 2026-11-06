-- READ-ONLY catalog inventory. No application rows, tokens, credentials or DDL.
-- Run through an authorized connection. inspected_as identifies what this proves:
-- owner-run privilege inspection is NOT an actual application-role write test.
-- Missing relations and raw-reader privileges are blockers, not permission to migrate/revoke.
select
  current_user as inspected_as,
  current_setting('server_version') as server_version,
  (select jsonb_agg(jsonb_build_object('object',n,'exists',to_regclass(n) is not null))
   from unnest(array[
     'public.artist_vault_sources',
     'mn_private.artist_bio_provenance',
     'mn_private.artist_bio_version_provenance',
     'mn_private.public_url_receipts',
     'mn_private.legacy_bio_publications',
     'mn_public.artists'
   ]) n) as objects,
  (select jsonb_agg(jsonb_build_object(
    'role',rolname,'superuser',rolsuper,'bypassrls',rolbypassrls,
    'raw_bio_select',has_column_privilege(oid,'public.artists','bio','SELECT')))
   from pg_roles where rolname in
    ('mnweb','readonly_user','webmapdata_editor','anon','authenticated')) as roles,
  (select jsonb_agg(jsonb_build_object(
    'table',tablename,'policy',policyname,'roles',roles,'command',cmd,'using',qual))
   from pg_policies where schemaname='public' and tablename='artists') as artist_policies;

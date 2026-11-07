-- Audit all non-system roles, including NOLOGIN groups and SET ROLE paths.
-- Existing platform operators remain trusted; no replacement reader is created.
DO $$ BEGIN
 IF NOT has_table_privilege('mnweb','public.artists','SELECT') THEN
  RAISE EXCEPTION 'Existing application read access missing';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r
 WHERE NOT r.rolsuper AND r.rolname !~ '^pg_'
 AND r.rolname NOT IN ('mnweb','postgres','supabase_etl_admin','supabase_read_only_user','cli_login_postgres','supabase_admin')
 AND (has_any_column_privilege(r.oid,'public.artists','SELECT')
 OR EXISTS(SELECT 1 FROM pg_roles reachable WHERE pg_has_role(r.oid,reachable.oid,'MEMBER')
  AND has_any_column_privilege(reachable.oid,'public.artists','SELECT'))
 OR pg_has_role(r.oid,'mnweb','MEMBER')))
 THEN RAISE EXCEPTION 'Unexpected public raw access; explicit grant review required'; END IF;
END $$;

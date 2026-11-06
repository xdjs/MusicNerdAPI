-- Music Nerd access-only candidate. Explicit production revocation approval required.
SAVEPOINT mn_about_access_cutover;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Schema USAGE is shared; never revoke unrelated consumers. The only owner-role
-- membership exception is the audited Supabase-managed CLI identity. Attribute
-- or membership drift fails closed; this does not grant or change any role.
DO $$
DECLARE managed_cli oid;
BEGIN
 SELECT r.oid INTO managed_cli
 FROM pg_roles r
 JOIN pg_namespace n ON n.nspname='mn_private'
 JOIN pg_roles owner_role ON owner_role.oid=n.nspowner
 JOIN pg_auth_members m ON m.member=r.oid AND m.roleid=n.nspowner
 JOIN pg_roles grantor_role ON grantor_role.oid=m.grantor
 WHERE current_user='postgres' AND owner_role.rolname='postgres'
  AND r.rolname='cli_login_postgres'
  AND NOT r.rolsuper AND NOT r.rolinherit AND NOT r.rolcreaterole
  AND NOT r.rolcreatedb AND r.rolcanlogin AND NOT r.rolreplication
  AND NOT r.rolbypassrls AND r.rolconnlimit=-1
  AND grantor_role.rolname='supabase_admin'
  AND grantor_role.rolsuper AND grantor_role.rolinherit AND grantor_role.rolcreaterole
  AND grantor_role.rolcreatedb AND grantor_role.rolcanlogin AND grantor_role.rolreplication
  AND grantor_role.rolbypassrls AND grantor_role.rolconnlimit=-1
  AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option
  AND (SELECT count(*) FROM pg_auth_members WHERE member=r.oid)=1
  AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid=r.oid)
  AND NOT has_schema_privilege(r.oid,n.oid,'CREATE');
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cli_login_postgres'
   AND (managed_cli IS NULL OR oid<>managed_cli))
 THEN RAISE EXCEPTION 'Unexpected managed CLI role attributes or membership'; END IF;
 IF current_user IN ('mnweb','anon','authenticated') OR NOT EXISTS (
  SELECT 1 FROM pg_namespace WHERE nspname='mn_private'
   AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
 ) OR EXISTS (
  SELECT 1 FROM pg_roles r JOIN pg_namespace n ON n.nspname='mn_private'
  WHERE NOT r.rolsuper AND r.oid<>n.nspowner
   AND (managed_cli IS NULL OR r.oid<>managed_cli)
   AND (has_schema_privilege(r.oid,n.oid,'CREATE')
    OR pg_has_role(r.oid,n.nspowner,'MEMBER')
    OR (r.rolname<>'mnweb' AND pg_has_role(r.oid,'mnweb','MEMBER')))
 ) THEN RAISE EXCEPTION 'Unsafe private schema owner, CREATE privilege or app role membership'; END IF;
END $$;

-- Read-only assertions: preserve existing managed operator authority; grant nothing.
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Production owner session required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls AND rolcanlogin AND rolcreaterole AND rolcreatedb)
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin' AND rolsuper AND rolbypassrls)
 THEN RAISE EXCEPTION 'Production operator identity drift'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES ('supabase_etl_admin',true),('supabase_read_only_user',false)) expected(name,replication)
 LEFT JOIN pg_roles r ON r.rolname=expected.name
 WHERE r.oid IS NULL OR r.rolsuper OR NOT r.rolbypassrls OR NOT r.rolcanlogin OR NOT r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication<>expected.replication OR r.rolconnlimit<>-1
 OR (SELECT count(*) FROM pg_auth_members WHERE member=r.oid)<>CASE WHEN expected.replication THEN 3 ELSE 2 END
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=r.oid AND (parent.rolname NOT IN ('pg_monitor','pg_read_all_data') AND NOT(expected.replication AND parent.rolname='supabase_privileged_role') OR grantor.rolname<>'supabase_admin' OR m.admin_option OR NOT m.inherit_option OR NOT m.set_option))
 OR NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=r.oid AND parent.rolname='pg_read_all_data' AND grantor.rolname='supabase_admin' AND NOT m.admin_option AND m.inherit_option AND m.set_option))
 THEN RAISE EXCEPTION 'Managed reader identity drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE NOT r.rolsuper AND (r.rolcanlogin OR r.rolname IN ('anon','authenticated','service_role')) AND r.rolname NOT IN ('postgres','supabase_etl_admin','supabase_read_only_user','cli_login_postgres')
 AND (pg_has_role(r.oid,'postgres','MEMBER') OR pg_has_role(r.oid,'supabase_admin','MEMBER') OR pg_has_role(r.oid,'pg_read_all_data','MEMBER')
 OR EXISTS(SELECT 1 FROM pg_roles target WHERE target.rolname IN ('cli_login_postgres','supabase_etl_admin','supabase_read_only_user') AND pg_has_role(r.oid,target.oid,'MEMBER'))))
 THEN RAISE EXCEPTION 'Unexpected operator membership path'; END IF;
 -- A retired role may be absent or NOLOGIN. It must not be an operator or shared role.
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='webmapdata_editor' AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname='webmapdata_editor')
 THEN RAISE EXCEPTION 'Retired reader identity or membership drift'; END IF;
END $$;

REVOKE SELECT ON public.artists FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='webmapdata_editor') THEN
  REVOKE SELECT ON public.artists FROM webmapdata_editor;
  IF has_any_column_privilege('webmapdata_editor','public.artists','SELECT') THEN
   RAISE EXCEPTION 'Retired reader retains raw artist access';
  END IF;
 END IF;
END $$;
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

RELEASE SAVEPOINT mn_about_access_cutover;

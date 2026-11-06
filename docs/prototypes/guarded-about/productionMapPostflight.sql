-- Unexpected default grants fail the enclosing transaction; never silently broaden audience.
DO $$ DECLARE owner_oid oid := (SELECT oid FROM pg_roles WHERE rolname='mn_projection_reader'); BEGIN
 IF (SELECT count(*) FROM pg_namespace WHERE nspname IN ('mn_public','mn_projection') AND nspowner=owner_oid)<>2
 OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
 WHERE n.nspname IN ('mn_public','mn_projection') AND a.grantee<>owner_oid
 AND (n.nspname<>'mn_public' OR a.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('mnweb','webmapdata_editor')) OR a.privilege_type<>'USAGE' OR a.is_grantable))
 THEN RAISE EXCEPTION 'Unexpected projection schema access'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='mn_public.artists'::regclass AND relkind='v' AND relowner=owner_oid)
 OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE c.oid='mn_public.artists'::regclass AND a.grantee<>owner_oid AND (a.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('mnweb','webmapdata_editor')) OR a.privilege_type<>'SELECT' OR a.is_grantable))
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mn_public.artists'::regclass AND attacl IS NOT NULL)
 THEN RAISE EXCEPTION 'Unexpected projection view access'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='mn_projection'::regnamespace)<>4
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='mn_projection'::regnamespace AND (p.proowner<>owner_oid OR p.proname NOT IN ('revision','safe_url','public_bio','artist_shape_current')))
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.pronamespace='mn_projection'::regnamespace AND a.grantee<>owner_oid
 AND (p.proname NOT IN ('public_bio','artist_shape_current') OR a.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('mnweb','webmapdata_editor')) OR a.privilege_type<>'EXECUTE' OR a.is_grantable))
 THEN RAISE EXCEPTION 'Unexpected projector function access'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE (r.rolcanlogin OR r.rolname IN ('anon','authenticated','service_role')) AND NOT r.rolsuper
 AND r.rolname NOT IN ('postgres','supabase_etl_admin','supabase_read_only_user','cli_login_postgres','mnweb','webmapdata_editor')
 AND (has_table_privilege(r.oid,'mn_public.artists','SELECT') OR pg_has_role(r.oid,'webmapdata_editor','MEMBER') OR pg_has_role(r.oid,'mn_projection_reader','MEMBER')))
 THEN RAISE EXCEPTION 'Unexpected effective projection reader'; END IF;
END $$;

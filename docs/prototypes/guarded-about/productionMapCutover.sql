-- Production-shaped candidate: approval and coordinated client cutover required.
SAVEPOINT mn_about_map_cutover;
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
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='webmapdata_editor' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname='webmapdata_editor')
 OR has_table_privilege('webmapdata_editor','public.artists','INSERT')
 OR has_table_privilege('webmapdata_editor','public.artists','DELETE')
 OR NOT has_column_privilege('webmapdata_editor','public.artists','webmapdata','UPDATE')
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'webmapdata' AND has_column_privilege('webmapdata_editor','public.artists',attname,'UPDATE'))
 THEN RAISE EXCEPTION 'Production map write contract drift'; END IF;
END $$;

DO $$ BEGIN IF (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[{"name":"id","type":"uuid"},{"name":"legacy_id","type":"text"},{"name":"bandcamp","type":"text"},{"name":"facebook","type":"text"},{"name":"x","type":"text"},{"name":"soundcloud","type":"text"},{"name":"notes","type":"text"},{"name":"patreon","type":"text"},{"name":"name","type":"text"},{"name":"instagram","type":"text"},{"name":"youtube","type":"text"},{"name":"youtubechannel","type":"text"},{"name":"lcname","type":"text"},{"name":"soundcloudID","type":"integer"},{"name":"spotify","type":"text"},{"name":"twitch","type":"text"},{"name":"imdb","type":"text"},{"name":"musicbrainz","type":"text"},{"name":"wikidata","type":"text"},{"name":"mixcloud","type":"text"},{"name":"facebookID","type":"text"},{"name":"discogs","type":"text"},{"name":"tiktok","type":"text"},{"name":"tiktokID","type":"text"},{"name":"jaxsta","type":"text"},{"name":"famousbirthdays","type":"text"},{"name":"songexploder","type":"text"},{"name":"colorsxstudios","type":"text"},{"name":"bandsintown","type":"text"},{"name":"linktree","type":"text"},{"name":"onlyfans","type":"text"},{"name":"wikipedia","type":"text"},{"name":"audius","type":"text"},{"name":"zora","type":"text"},{"name":"catalog","type":"text"},{"name":"opensea","type":"text"},{"name":"foundation","type":"text"},{"name":"lastfm","type":"text"},{"name":"linkedin","type":"text"},{"name":"soundxyz","type":"text"},{"name":"mirror","type":"text"},{"name":"glassnode","type":"text"},{"name":"collectsNFTs","type":"boolean"},{"name":"spotifyusername","type":"text"},{"name":"bandcampfan","type":"text"},{"name":"tellie","type":"text"},{"name":"wallets","type":"text[]"},{"name":"ens","type":"text"},{"name":"lens","type":"text"},{"name":"added_by","type":"uuid"},{"name":"cameo","type":"text"},{"name":"farcaster","type":"text"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"},{"name":"supercollector","type":"text"},{"name":"bio","type":"text"},{"name":"webmapdata","type":"jsonb"},{"name":"node_pfp","type":"jsonb"},{"name":"custom_image","type":"text"},{"name":"deezer","type":"text"},{"name":"subvert","type":"text"},{"name":"bluesky","type":"text"},{"name":"inprocess","type":"text"},{"name":"link_order","type":"jsonb"},{"name":"header_image_position","type":"jsonb"}]'::jsonb THEN RAISE EXCEPTION 'Pinned artist column contract changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('webmapdata_editor') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Trusted role cannot be classified as a public reader'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles client WHERE client.rolname IN ('webmapdata_editor') AND (pg_has_role('anon',client.oid,'MEMBER') OR pg_has_role('authenticated',client.oid,'MEMBER'))) THEN RAISE EXCEPTION 'Denied public role can assume an approved reader'; END IF;
 END $$;
REVOKE SELECT ON public.artists FROM "webmapdata_editor";
-- ISOLATED DESIGN PROTOTYPE ONLY. Not a production migration.
-- Requires synthetic fixture tables and roles; never registered in Drizzle.
CREATE ROLE mn_projection_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT mn_projection_reader TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;
CREATE SCHEMA mn_projection AUTHORIZATION mn_projection_reader;
CREATE SCHEMA mn_public AUTHORIZATION mn_projection_reader;
REVOKE ALL ON SCHEMA mn_projection,mn_public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,mn_private TO mn_projection_reader;
GRANT SELECT ON public.artists,public.artist_claims,public.artist_vault_sources,public.artist_activity_events,mn_private.artist_bio_provenance,mn_private.legacy_bio_publications TO mn_projection_reader;
CREATE POLICY projection_read ON public.artists FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_claims FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_vault_sources FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_activity_events FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON mn_private.legacy_bio_publications FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON mn_private.artist_bio_provenance FOR SELECT TO mn_projection_reader USING(true);

-- Exact array-of-nullable-text serialization for the current vault revision contract.
CREATE FUNCTION mn_projection.revision(v public.artist_vault_sources) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog SET datestyle='ISO,YMD' AS $$
 SELECT encode(sha256(convert_to('[' || string_agg(coalesce(to_json(x)::text,'null'),',' ORDER BY n) || ']','UTF8')),'hex')
 FROM unnest(ARRAY[v.url,v.id::text,v.activity_id::text,v.origin,v.publication,v.extracted_text,v.title,v.snippet,v.published_at::text,v.file_path]) WITH ORDINALITY t(x,n)
$$;
ALTER FUNCTION mn_projection.revision(public.artist_vault_sources) OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.revision(public.artist_vault_sources) FROM PUBLIC;

-- Private receipts attest the existing JavaScript URL policy, never SQL URL parsing.
-- Trusted writers must prepare receipts atomically with evidence publication.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='mn_private.public_url_receipts'::regclass AND relkind='r' AND relrowsecurity)
 OR (SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid='mn_private.public_url_receipts'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[["url_hash","bytea",true],["url","text",true],["policy_version","integer",true]]'::jsonb
 OR NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_collation c ON c.oid=a.attcollation WHERE a.attrelid='mn_private.public_url_receipts'::regclass AND a.attname='url' AND c.collname='C' AND c.collnamespace='pg_catalog'::regnamespace)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='p' AND conkey=ARRAY[1,3]::smallint[])
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='c' AND convalidated AND regexp_replace(pg_get_expr(conbin,conrelid),'[()[:space:]]','','g')='octet_lengthurl_hash=32')
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='mn_private.public_url_receipts'::regclass AND contype='c' AND convalidated AND regexp_replace(pg_get_expr(conbin,conrelid),'[()[:space:]]','','g')='policy_version>0')
 THEN RAISE EXCEPTION 'Existing receipt schema does not match migration0062'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='mn_private.public_url_receipts'::regclass AND (a.grantee NOT IN(c.relowner,(SELECT oid FROM pg_roles WHERE rolname='mnweb')) OR (a.grantee=(SELECT oid FROM pg_roles WHERE rolname='mnweb') AND (a.privilege_type NOT IN('SELECT','INSERT') OR a.is_grantable))))
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='mn_private.public_url_receipts'::regclass AND attacl IS NOT NULL)
 OR NOT has_table_privilege('mnweb','mn_private.public_url_receipts','SELECT') OR NOT has_table_privilege('mnweb','mn_private.public_url_receipts','INSERT')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass)<>2
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass AND polcmd='r' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='mnweb')] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL)
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='mn_private.public_url_receipts'::regclass AND polcmd='a' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='mnweb')] AND polqual IS NULL AND pg_get_expr(polwithcheck,polrelid)='true')
 THEN RAISE EXCEPTION 'Existing receipt access differs from migration0062'; END IF;
 END $$;
 GRANT SELECT ON mn_private.public_url_receipts TO mn_projection_reader;
 CREATE POLICY receipt_projection_read ON mn_private.public_url_receipts FOR SELECT TO mn_projection_reader USING(true);
CREATE FUNCTION mn_projection.safe_url(value text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM mn_private.public_url_receipts r
 WHERE r.policy_version=1 AND r.url_hash=sha256(convert_to(value,'UTF8'))
 AND convert_to(r.url,'UTF8')=convert_to(value,'UTF8'))
$$;
ALTER FUNCTION mn_projection.safe_url(text) OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.safe_url(text) FROM PUBLIC;

CREATE FUNCTION mn_projection.public_bio(requested_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.artists%ROWTYPE; p jsonb; current_claim_id text; s jsonb; trimmed text; seen numeric[] := '{}';
BEGIN
 SELECT * INTO a FROM public.artists WHERE id=requested_id;
 IF NOT FOUND OR a.bio IS NULL THEN RETURN NULL; END IF;
 trimmed := btrim(a.bio,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 IF trimmed='' OR trimmed='We don''t have enough verified information about this artist yet. If this is you, claim your profile and add a few sources to generate your About — or write your own. What you add helps Music Nerd tell your story to fans.' THEN RETURN NULL; END IF;
 SELECT id::text INTO current_claim_id FROM public.artist_claims WHERE artist_id=a.id AND status='approved' LIMIT 1;
 SELECT provenance INTO p FROM mn_private.artist_bio_provenance WHERE artist_id=a.id;
 IF NOT FOUND THEN RETURN CASE WHEN EXISTS(SELECT 1 FROM mn_private.legacy_bio_publications lp
   WHERE lp.artist_id=a.id AND lp.claim_id::text=current_claim_id
     AND lp.bio_hash=encode(sha256(convert_to(a.bio,'UTF8')),'hex')) THEN a.bio ELSE NULL END; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->'version' IS DISTINCT FROM '1'::jsonb
 OR jsonb_typeof(p->'kind') IS DISTINCT FROM 'string' OR p->>'kind' NOT IN ('generated','authored')
 OR jsonb_typeof(p->'bioHash') IS DISTINCT FROM 'string'
 OR p->>'bioHash' IS DISTINCT FROM encode(sha256(convert_to(a.bio,'UTF8')),'hex')
 OR NOT(p ? 'claimId') OR jsonb_typeof(p->'claimId') NOT IN ('string','null')
 OR (p->>'claimId' IS NOT NULL AND p->>'claimId' IS DISTINCT FROM current_claim_id)
 OR jsonb_typeof(p->'sources') IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF p->>'kind'='authored' AND p->>'claimId' IS NULL THEN RETURN NULL; END IF;
 IF (p->>'claimId' IS NULL OR p->>'kind'='generated') AND jsonb_array_length(p->'sources')=0 THEN RETURN NULL; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(p->'sources') LOOP
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(s->'id') IS DISTINCT FROM 'number' THEN RETURN NULL; END IF;
  IF (s->>'id')::numeric<1 OR (s->>'id')::numeric>9007199254740991 OR trunc((s->>'id')::numeric)<>(s->>'id')::numeric
  OR (s->>'id')::numeric=ANY(seen) OR jsonb_typeof(s->'kind') IS DISTINCT FROM 'string'
  OR s->>'kind' NOT IN ('vault','interview','social') OR NOT(s ? 'url')
  OR (s->'url'<>'null'::jsonb AND (jsonb_typeof(s->'url') IS DISTINCT FROM 'string' OR NOT mn_projection.safe_url(s->>'url')))
  OR (p->>'claimId' IS NULL AND s->>'kind'<>'vault') THEN RETURN NULL; END IF;
  seen := array_append(seen,(s->>'id')::numeric);
  IF s->>'kind'<>'vault' THEN CONTINUE; END IF;
  IF jsonb_typeof(s->'revision') IS DISTINCT FROM 'string' OR (s->>'revision') !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.artist_vault_sources v
   WHERE v.artist_id=a.id AND v.url=s->>'url' AND mn_projection.revision(v)=s->>'revision'
   AND v.status='approved' AND (v.publication='public' OR (v.publication='inherit' AND (
    current_claim_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.artist_activity_events e
     WHERE e.id=v.activity_id AND e.artist_id=v.artist_id AND e.source_id=v.id
     AND e.actor_kind='user' AND e.actor_user_id IS NOT NULL AND e.trigger='trusted_submission'
     AND ((v.origin='upload' AND e.action='source_upload') OR (v.origin='submission' AND e.action='source_submission')))))))
  THEN RETURN NULL; END IF;
 END LOOP;
 RETURN a.bio;
END $$;
ALTER FUNCTION mn_projection.public_bio(uuid) OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.public_bio(uuid) FROM PUBLIC;
-- Function invocation through the view requires EXECUTE; no private-schema USAGE.
GRANT EXECUTE ON FUNCTION mn_projection.public_bio(uuid) TO anon,authenticated,mnweb;
CREATE FUNCTION mn_projection.artist_shape_current() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN IF (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[{"name":"id","type":"uuid"},{"name":"legacy_id","type":"text"},{"name":"bandcamp","type":"text"},{"name":"facebook","type":"text"},{"name":"x","type":"text"},{"name":"soundcloud","type":"text"},{"name":"notes","type":"text"},{"name":"patreon","type":"text"},{"name":"name","type":"text"},{"name":"instagram","type":"text"},{"name":"youtube","type":"text"},{"name":"youtubechannel","type":"text"},{"name":"lcname","type":"text"},{"name":"soundcloudID","type":"integer"},{"name":"spotify","type":"text"},{"name":"twitch","type":"text"},{"name":"imdb","type":"text"},{"name":"musicbrainz","type":"text"},{"name":"wikidata","type":"text"},{"name":"mixcloud","type":"text"},{"name":"facebookID","type":"text"},{"name":"discogs","type":"text"},{"name":"tiktok","type":"text"},{"name":"tiktokID","type":"text"},{"name":"jaxsta","type":"text"},{"name":"famousbirthdays","type":"text"},{"name":"songexploder","type":"text"},{"name":"colorsxstudios","type":"text"},{"name":"bandsintown","type":"text"},{"name":"linktree","type":"text"},{"name":"onlyfans","type":"text"},{"name":"wikipedia","type":"text"},{"name":"audius","type":"text"},{"name":"zora","type":"text"},{"name":"catalog","type":"text"},{"name":"opensea","type":"text"},{"name":"foundation","type":"text"},{"name":"lastfm","type":"text"},{"name":"linkedin","type":"text"},{"name":"soundxyz","type":"text"},{"name":"mirror","type":"text"},{"name":"glassnode","type":"text"},{"name":"collectsNFTs","type":"boolean"},{"name":"spotifyusername","type":"text"},{"name":"bandcampfan","type":"text"},{"name":"tellie","type":"text"},{"name":"wallets","type":"text[]"},{"name":"ens","type":"text"},{"name":"lens","type":"text"},{"name":"added_by","type":"uuid"},{"name":"cameo","type":"text"},{"name":"farcaster","type":"text"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"},{"name":"supercollector","type":"text"},{"name":"bio","type":"text"},{"name":"webmapdata","type":"jsonb"},{"name":"node_pfp","type":"jsonb"},{"name":"custom_image","type":"text"},{"name":"deezer","type":"text"},{"name":"subvert","type":"text"},{"name":"bluesky","type":"text"},{"name":"inprocess","type":"text"},{"name":"link_order","type":"jsonb"},{"name":"header_image_position","type":"jsonb"}]'::jsonb THEN RAISE EXCEPTION 'Pinned artist column contract changed'; END IF; RETURN true; END $$;
ALTER FUNCTION mn_projection.artist_shape_current() OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.artist_shape_current() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mn_projection.artist_shape_current() TO anon,authenticated,mnweb,"webmapdata_editor";
CREATE VIEW mn_public.artists WITH(security_barrier=true) AS SELECT a."id",a."legacy_id",a."bandcamp",a."facebook",a."x",a."soundcloud",a."notes",a."patreon",a."name",a."instagram",a."youtube",a."youtubechannel",a."lcname",a."soundcloudID",a."spotify",a."twitch",a."imdb",a."musicbrainz",a."wikidata",a."mixcloud",a."facebookID",a."discogs",a."tiktok",a."tiktokID",a."jaxsta",a."famousbirthdays",a."songexploder",a."colorsxstudios",a."bandsintown",a."linktree",a."onlyfans",a."wikipedia",a."audius",a."zora",a."catalog",a."opensea",a."foundation",a."lastfm",a."linkedin",a."soundxyz",a."mirror",a."glassnode",a."collectsNFTs",a."spotifyusername",a."bandcampfan",a."tellie",a."wallets",a."ens",a."lens",a."added_by",a."cameo",a."farcaster",a."created_at",a."updated_at",a."supercollector",mn_projection.public_bio(a.id) AS "bio",a."webmapdata",a."node_pfp",a."custom_image",a."deezer",a."subvert",a."bluesky",a."inprocess",a."link_order",a."header_image_position" FROM public.artists a WHERE mn_projection.artist_shape_current();
ALTER VIEW mn_public.artists OWNER TO mn_projection_reader;
REVOKE ALL ON mn_public.artists FROM PUBLIC;
GRANT USAGE ON SCHEMA mn_public TO anon,authenticated,mnweb;
GRANT SELECT ON mn_public.artists TO anon,authenticated,mnweb;
-- Synthetic cutover: leave trusted writers intact, remove the old public bypass.
REVOKE SELECT ON public.artists FROM PUBLIC,anon,authenticated;
-- Fail closed on leftover column grants or inherited raw-reader privileges.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE (r.rolcanlogin OR r.rolname IN ('anon','authenticated'))
 AND NOT r.rolsuper AND r.rolname NOT IN ('mnweb','mn_projection_reader','postgres','supabase_etl_admin','supabase_read_only_user','cli_login_postgres')
 AND (has_any_column_privilege(r.oid,'public.artists','SELECT')
 OR EXISTS(SELECT 1 FROM pg_roles reachable
  WHERE pg_has_role(r.oid,reachable.oid,'MEMBER')
  AND has_any_column_privilege(reachable.oid,'public.artists','SELECT'))
 OR pg_has_role(r.oid,'mn_projection_reader','MEMBER')
 OR pg_has_role(r.oid,'mnweb','MEMBER')))
 THEN RAISE EXCEPTION 'Unexpected public raw access; explicit grant review required'; END IF;
END $$;

GRANT USAGE ON SCHEMA mn_public TO "webmapdata_editor";
GRANT SELECT ON mn_public.artists TO "webmapdata_editor";
GRANT EXECUTE ON FUNCTION mn_projection.public_bio(uuid) TO "webmapdata_editor";
GRANT SELECT(id,name,webmapdata) ON public.artists TO "webmapdata_editor";
REVOKE ALL ON mn_public.artists FROM anon,authenticated;REVOKE USAGE ON SCHEMA mn_public FROM anon,authenticated;REVOKE EXECUTE ON FUNCTION mn_projection.public_bio(uuid),mn_projection.artist_shape_current() FROM anon,authenticated;
DO $$ BEGIN
 IF has_column_privilege('webmapdata_editor','public.artists','bio','SELECT')
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'webmapdata' AND has_column_privilege('webmapdata_editor','public.artists',attname,'UPDATE'))
 THEN RAISE EXCEPTION 'Map role has broader privileges than the audited column contract'; END IF;
 END $$;

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
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='webmapdata_editor' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname='webmapdata_editor')
 OR has_table_privilege('webmapdata_editor','public.artists','INSERT')
 OR has_table_privilege('webmapdata_editor','public.artists','DELETE')
 OR NOT has_column_privilege('webmapdata_editor','public.artists','webmapdata','UPDATE')
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.artists'::regclass AND attnum>0 AND NOT attisdropped AND attname<>'webmapdata' AND has_column_privilege('webmapdata_editor','public.artists',attname,'UPDATE'))
 THEN RAISE EXCEPTION 'Production map write contract drift'; END IF;
END $$;

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

REVOKE SET OPTION FOR mn_projection_reader FROM CURRENT_USER;
REVOKE INHERIT OPTION FOR mn_projection_reader FROM CURRENT_USER;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='mn_projection_reader' AND m.member=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND (m.inherit_option OR m.set_option)) THEN RAISE EXCEPTION 'Temporary projector privilege retained'; END IF; END $$;
RELEASE SAVEPOINT mn_about_map_cutover;

-- ISOLATED DESIGN PROTOTYPE ONLY. Not a production migration.
-- Requires synthetic fixture tables and roles; never registered in Drizzle.
CREATE ROLE mn_projection_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
CREATE SCHEMA mn_projection AUTHORIZATION mn_projection_reader;
CREATE SCHEMA mn_public AUTHORIZATION mn_projection_reader;
REVOKE ALL ON SCHEMA mn_projection,mn_public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,mn_private TO mn_projection_reader;
GRANT SELECT ON public.artists,public.artist_claims,public.artist_vault_sources,public.artist_activity_events,mn_private.artist_bio_provenance TO mn_projection_reader;
CREATE POLICY projection_read ON public.artists FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_claims FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_vault_sources FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON public.artist_activity_events FOR SELECT TO mn_projection_reader USING(true);
CREATE POLICY projection_read ON mn_private.artist_bio_provenance FOR SELECT TO mn_projection_reader USING(true);

-- Exact array-of-nullable-text serialization for the current vault revision contract.
CREATE FUNCTION mn_projection.revision(v public.artist_vault_sources) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog SET datestyle='ISO,YMD' AS $$
 SELECT encode(sha256(convert_to('[' || string_agg(coalesce(to_json(x)::text,'null'),',' ORDER BY n) || ']','UTF8')),'hex')
 FROM unnest(ARRAY[v.url,v.id::text,v.activity_id::text,v.origin,v.publication,v.extracted_text,v.title,v.snippet,v.published_at::text,v.file_path]) WITH ORDINALITY t(x,n)
$$;
ALTER FUNCTION mn_projection.revision(public.artist_vault_sources) OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.revision(public.artist_vault_sources) FROM PUBLIC;

-- Deliberately bounded URL grammar. Full WHATWG parity remains a release gate.
CREATE FUNCTION mn_projection.safe_url(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE query_text text; part text; key text; port text;
BEGIN
 IF value IS NULL OR value ~* '(^https?://|[.])xn--'
 OR value !~* '^https?://[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+(:[0-9]{1,5})?([/?#][A-Za-z0-9._~/%:@!$&()*+,;=/?#-]*)?$' THEN RETURN false; END IF;
 port:=substring(lower(value) from '^https?://[^/?#:]+:([0-9]+)');
 IF port IS NOT NULL AND port::integer>65535 THEN RETURN false; END IF;
 query_text:=substring(value from '\?([^#]*)');
 IF query_text IS NOT NULL THEN
  FOREACH part IN ARRAY string_to_array(query_text,'&') LOOP
   key:=split_part(part,'=',1);
   -- Reject encoded keys until exact URLSearchParams decoding is implemented.
   IF key LIKE '%\%%' OR key ~* 'token|secret|signature|api[-_]?key' THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;
ALTER FUNCTION mn_projection.safe_url(text) OWNER TO mn_projection_reader;
REVOKE ALL ON FUNCTION mn_projection.safe_url(text) FROM PUBLIC;

CREATE FUNCTION mn_projection.public_bio(requested_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.artists%ROWTYPE; p jsonb; claim_id text; s jsonb; trimmed text; seen numeric[] := '{}';
BEGIN
 SELECT * INTO a FROM public.artists WHERE id=requested_id;
 IF NOT FOUND OR a.bio IS NULL THEN RETURN NULL; END IF;
 trimmed := btrim(a.bio,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 IF trimmed='' OR trimmed='We don''t have enough verified information about this artist yet. If this is you, claim your profile and add a few sources to generate your About — or write your own. What you add helps Music Nerd tell your story to fans.' THEN RETURN NULL; END IF;
 SELECT id::text INTO claim_id FROM public.artist_claims WHERE artist_id=a.id AND status='approved' LIMIT 1;
 SELECT provenance INTO p FROM mn_private.artist_bio_provenance WHERE artist_id=a.id;
 IF NOT FOUND THEN RETURN CASE WHEN claim_id IS NOT NULL THEN a.bio ELSE NULL END; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->'version' IS DISTINCT FROM '1'::jsonb
 OR jsonb_typeof(p->'kind') IS DISTINCT FROM 'string' OR p->>'kind' NOT IN ('generated','authored')
 OR jsonb_typeof(p->'bioHash') IS DISTINCT FROM 'string'
 OR p->>'bioHash' IS DISTINCT FROM encode(sha256(convert_to(a.bio,'UTF8')),'hex')
 OR NOT(p ? 'claimId') OR jsonb_typeof(p->'claimId') NOT IN ('string','null')
 OR (p->>'claimId' IS NOT NULL AND p->>'claimId' IS DISTINCT FROM claim_id)
 OR jsonb_typeof(p->'sources') IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF p->>'kind'='authored' AND p->>'claimId' IS NULL THEN RETURN NULL; END IF;
 IF p->>'claimId' IS NULL AND jsonb_array_length(p->'sources')=0 THEN RETURN NULL; END IF;
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
    claim_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.artist_activity_events e
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
CREATE VIEW mn_public.artists WITH(security_barrier=true) AS
 SELECT a.id,a.name,mn_projection.public_bio(a.id) AS bio FROM public.artists a;
ALTER VIEW mn_public.artists OWNER TO mn_projection_reader;
REVOKE ALL ON mn_public.artists FROM PUBLIC;
GRANT USAGE ON SCHEMA mn_public TO anon,authenticated,mnweb;
GRANT SELECT ON mn_public.artists TO anon,authenticated,mnweb;
-- Synthetic cutover: leave trusted writers intact, remove the old public bypass.
REVOKE SELECT ON public.artists FROM PUBLIC,anon,authenticated;
-- Fail closed on leftover column grants or inherited raw-reader privileges.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE (r.rolcanlogin OR r.rolname IN ('anon','authenticated'))
 AND NOT r.rolsuper AND r.rolname NOT IN ('mnweb','mn_projection_reader')
 AND (has_any_column_privilege(r.oid,'public.artists','SELECT')
 OR EXISTS(SELECT 1 FROM pg_roles reachable
  WHERE pg_has_role(r.oid,reachable.oid,'MEMBER')
  AND has_any_column_privilege(reachable.oid,'public.artists','SELECT'))
 OR pg_has_role(r.oid,'mn_projection_reader','MEMBER')
 OR pg_has_role(r.oid,'mnweb','MEMBER')))
 THEN RAISE EXCEPTION 'Unexpected public raw access; explicit grant review required'; END IF;
END $$;

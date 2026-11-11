-- Emergency fail-closed fallback for the REVIEWED guarded projection only.
-- Caller must gate traffic/producers; run in a bounded transaction. No ACL is restored.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=to_regclass('mn_public.artists') AND relkind='v' AND relowner=(SELECT oid FROM pg_roles WHERE rolname='mn_projection_reader')) OR NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='mn_projection' AND p.proname='public_bio'
   AND p.oid=to_regprocedure('mn_projection.public_bio(uuid)')
   AND p.prorettype='text'::regtype AND p.prosecdef
   AND p.proowner=(SELECT oid FROM pg_roles WHERE rolname='mn_projection_reader')
   AND EXISTS(SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid
    WHERE r.ev_class=to_regclass('mn_public.artists') AND d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid)
 ) THEN RAISE EXCEPTION 'Expected guarded projection not installed; refuse fallback'; END IF;
END $$;
CREATE OR REPLACE FUNCTION mn_projection.public_bio(requested_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT NULL::text $$;
-- CREATE OR REPLACE retains owner and ACL. Private evidence, artist text/history,
-- raw-read denials and consumed legacy permissions remain untouched.

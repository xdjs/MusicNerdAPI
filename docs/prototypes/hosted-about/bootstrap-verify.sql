-- Fictional fixtures only. All rows roll back before the disposable server stops.
BEGIN;
INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000002');
INSERT INTO artists(id,bio) VALUES('00000000-0000-4000-8000-000000000001','original');
INSERT INTO artist_claims(id,user_id,artist_id,status) VALUES('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','approved');
INSERT INTO artist_vault_sources(artist_id,url,status,publication,extracted_text) VALUES('00000000-0000-4000-8000-000000000001','https://example.org/synthetic','approved','public','old evidence');
INSERT INTO mn_private.legacy_bio_publications VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',repeat('a',64));
SET LOCAL ROLE mnweb;
INSERT INTO artist_docs(artist_id,content) VALUES('00000000-0000-4000-8000-000000000001','synthetic Lore');
INSERT INTO artist_bio_versions(artist_id,bio_text) VALUES('00000000-0000-4000-8000-000000000001','original');
INSERT INTO artist_activity_events(artist_id,action,actor_kind,trigger) VALUES('00000000-0000-4000-8000-000000000001','about_generated','system','synthetic');
SAVEPOINT edit;
UPDATE artists SET bio='temporary';
ROLLBACK TO SAVEPOINT edit;
DO $$ BEGIN
 IF (SELECT bio FROM artists LIMIT 1) IS DISTINCT FROM 'original' OR (SELECT count(*) FROM mn_private.legacy_bio_publications)<>1 THEN RAISE EXCEPTION 'rollback failed';END IF;
END $$;
RESET ROLE;
UPDATE artist_vault_sources SET publication='private',extracted_text='new evidence';
SET LOCAL ROLE mnweb;
DO $$ BEGIN
 IF (SELECT count(*) FROM artist_vault_source_versions)<>1 THEN RAISE EXCEPTION 'source version trigger missing';END IF;
 IF EXISTS(SELECT 1 FROM mn_private.legacy_bio_publications) THEN RAISE EXCEPTION 'allowance not consumed';END IF;
 IF has_table_privilege('mnweb','mn_private.legacy_bio_publications','INSERT') THEN RAISE EXCEPTION 'allowance insert exposed';END IF;
 IF has_table_privilege('anon','public.artists','SELECT') OR has_table_privilege('authenticated','public.artists','SELECT') THEN RAISE EXCEPTION 'raw public access';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','mn_private','musicnerd_private') AND p.prosecdef AND has_function_privilege('mnweb',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'unrelated definer capability exposed';END IF;
END $$;
ROLLBACK;

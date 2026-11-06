-- Prototype app-role access ONLY for the allowlisted About route and its persistence.
-- Roles must be pre-provisioned separately. No role creation, inheritance or login changes.
REVOKE ALL ON SCHEMA mn_private,musicnerd_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,mn_private,musicnerd_private TO mnweb;
REVOKE ALL ON ALL TABLES IN SCHEMA mn_private,musicnerd_private FROM PUBLIC,anon,authenticated,mnweb;
GRANT SELECT,INSERT,UPDATE,DELETE ON mn_private.artist_bio_provenance,mn_private.artist_bio_version_provenance TO mnweb;
GRANT SELECT,INSERT ON mn_private.public_url_receipts TO mnweb;
GRANT SELECT ON mn_private.legacy_bio_publications TO mnweb;
-- Read authentication, claim and evidence; no user/claim mutations exposed by this prototype.
GRANT SELECT ON public.users,public.artist_claims,public.artist_activity_events,
 public.artist_interview_answers,public.artist_social_profiles,public.artist_social_posts TO mnweb;
GRANT SELECT ON public.artists TO mnweb;
GRANT UPDATE(bio) ON public.artists TO mnweb;
GRANT SELECT,INSERT,UPDATE ON public.artist_docs,public.artist_bio_versions,
 public.artist_onboarding_steps,public.artist_research_jobs TO mnweb;
GRANT SELECT,UPDATE(id) ON public.artist_vault_sources TO mnweb;
-- Source version triggers are SECURITY INVOKER and require explicit append privileges.
GRANT SELECT,INSERT ON public.artist_vault_source_versions,public.artist_social_post_versions TO mnweb;
-- No anon/authenticated read path is granted. Public projection is served by the authenticated app role.
-- Introspected legacy policies omit USING/WITH CHECK, which PostgreSQL treats as
-- deny-all here. Prototype-only explicit role policies supply the supported route
-- permissions; user ownership still MUST be checked by unchanged route auth.
CREATE POLICY prototype_about_read ON public.users FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artist_claims FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artist_vault_sources FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artist_interview_answers FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artist_social_profiles FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artist_social_posts FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_read ON public.artists FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_update ON public.artists FOR UPDATE TO mnweb USING(true) WITH CHECK(true);
CREATE POLICY prototype_about_read ON public.artist_bio_versions FOR SELECT TO mnweb USING(true);
CREATE POLICY prototype_about_insert ON public.artist_bio_versions FOR INSERT TO mnweb WITH CHECK(true);
CREATE POLICY prototype_about_update ON public.artist_bio_versions FOR UPDATE TO mnweb USING(true) WITH CHECK(true);
-- Keep SQL-only inventory for schema fidelity; do not expose unrelated definer capabilities.
REVOKE EXECUTE ON FUNCTION public.transfer_account_activity(uuid,uuid,text),
 musicnerd_private.disconnect_catalog_link(uuid,text,text,jsonb,uuid,uuid,text),
 musicnerd_private.catalog_link_was_disconnected(uuid,text),
 musicnerd_private.queue_catalog_counterpart(uuid) FROM mnweb;
GRANT INSERT ON public.artist_activity_events TO mnweb;
GRANT SELECT ON public.artist_directory_preparations,public.artist_source_assessments,public.artist_social_credits TO mnweb;
-- PostgreSQL SELECT FOR SHARE requires UPDATE privilege on at least one column.
-- Lock-only UPDATE policies below expose existing rows to locking SELECT while
-- WITH CHECK(false) denies actual account/claim mutations.
GRANT UPDATE(id) ON public.users,public.artist_claims TO mnweb;
GRANT UPDATE(id) ON public.artist_activity_events TO mnweb;
-- Locking SELECT also evaluates UPDATE USING. Permit row locks, but deny the
-- new-row WITH CHECK for actual mutations (even of the granted id column).
CREATE POLICY prototype_about_lock ON public.users FOR UPDATE TO mnweb USING(true) WITH CHECK(false);
CREATE POLICY prototype_about_lock ON public.artist_claims FOR UPDATE TO mnweb USING(true) WITH CHECK(false);
CREATE POLICY prototype_about_lock ON public.artist_activity_events FOR UPDATE TO mnweb USING(true) WITH CHECK(false);
CREATE POLICY prototype_about_lock ON public.artist_vault_sources FOR UPDATE TO mnweb USING(true) WITH CHECK(false);

# Fresh database bootstrap audit for #1655

Local audit only, 2026-11-04. Web source: `d219118f` in the isolated About worktree. No live database, production dump, native PostgreSQL daemon, provider, migration application or seed operation was used. These notes are not an executable hosted deployment approval.

## Result

The tracked migration chain cannot currently bootstrap a fresh database unchanged. A Supabase project alone does not repair the missing application baseline. Do not run `db:migrate` against a hosted target to discover these failures.

Pathless PGlite tests (synthetic empty databases) observed:

1. Replay the tracked journal verbatim: migration0000 does nothing because its entire DDL body is inside a block comment. Migration0001 fails `relation "users" does not exist`.
2. In memory only, uncomment0000 and supply synthetic UUID functions and empty roles:0000 fails `syntax error at or near "social"`. Its line195 `platform_type_list` default is malformed introspection output.
3. In memory only, replace that single default with `ARRAY['social']::platform_type[]`:0000 fails `there is no unique constraint matching given keys for referenced table "users"`. The baseline's `users.id` and `artists.id` declarations have no primary/unique constraint despite later foreign keys.

No tracked SQL was changed. The synthetic UUID stand-ins were only diagnostic and are not a proposed hosted substitute for extensions. Testing stopped at the first failure in each experiment; later migrations have not been proven replayable. This agrees with the existing migration-history reconciliation warning in Web `docs/development.md` (issue #1148).

## Managed and application prerequisites

- Baseline UUID defaults reference `extensions.uuid_generate_v4()`; later migrations use unqualified `uuid_generate_v4()`. A reviewed bootstrap must establish `uuid-ossp` and the intended extension/search-path configuration, then test both names as the app role.
- Baseline policies reference `mnweb`, `mn_bot`, and `webmapdata_editor`; later private-schema migrations also reference `anon` and `authenticated`. Hosted Supabase manages some roles, but the tracked chain does not create the custom application roles. Do not create broad grants merely to make replay pass.
- RLS policies are not grants. The baseline contains policies without a complete application-role table/sequence grant bootstrap; later migrations supply selected grants. Validate the final privilege matrix explicitly as `mnweb`, anon and authenticated.
- Web `supabase/config.toml` exposes public/graphql_public, sets the request extra search path to public/extensions, and targets PostgreSQL17. It tracks no Supabase migration files, has empty `schema_paths`, and references an untracked `seed.sql`. It is not a complete application bootstrap.
- The baseline inspected has application-owned foreign keys, not a demonstrated dependency on `auth.users` or storage catalog tables. This does not establish that a hosted app needs no auth/storage configuration: those services, buckets, credentials and browser authentication remain separate preparation work.
- Migrations0061–0063 create private provenance, URL receipts and exact legacy allowances.0063 seeds nothing. Do not import the reviewed legacy snapshot into a synthetic project; use fictional identities only.

## Required replay plan before a hosted test

1. Resolve an explicit isolated project/owner identity and least-privilege app-role plan. For native testing, separately define a new temporary cluster directory, private Unix socket directory, disabled TCP listener, unique database/roles, and an identity assertion before any SQL. No native cluster was started in this audit.
2. Prepare a separately reviewed fresh-install application baseline from tracked schema and required functions/triggers. Reconcile the malformed/default/missing-key/history discrepancies against issue #1148. Do not silently uncomment or patch the historical migration in a release.
3. Choose one coherent path: reconciled baseline plus subsequent journal migrations, or a reviewed current-schema bootstrap plus independently inventoried SQL functions/triggers/grants. Do not combine a current full schema with old CREATE/ALTER migrations. Drizzle schema/snapshot alone does not describe every historical function/trigger/grant.
4. Run that exact artifact in an empty disposable database with synthetic rows only. Record every statement failure; verify final schema/snapshot parity, functions, triggers, RLS, direct/default grants, inherited roles and search paths. Establish a consistent migration ledger only for the artifact actually applied.
5. Exercise real app-role CRUD, source eligibility, claim/pin/manual-edit preservation, allowance consumption/rollback, and public projection with synthetic identities. Native concurrent-request and cancellation tests remain required; PGlite does not establish multi-session lock behavior.
6. Only after that local proof, separately authorize hosted provisioning/application and configure the test-build artifact. The deterministic model adapter does not isolate unrelated routes, database connections, storage or network egress.

There is currently no verified exact hosted bootstrap command to provide. The concrete blockers above must be reconciled first; no real records are needed to do that work.

## Generated current-schema candidate

`fresh-schema.candidate.sql` is a **review-only** alternative produced locally by `generateMigration(generateDrizzleJson({}), generateDrizzleJson(currentWebSchema))`, pinned to Web `d219118f`. It contains413 generated statements and no application data. Historical migrations remain untouched.

Synthetic pathless PGlite results:

- With empty application roles and diagnostic UUID stand-ins,84 statements complete; creation of `musicnerd_private.catalog_link_disconnects` fails because generated output lacks that schema creation. This requires explicit reviewed scaffold ownership/access, not a guessed live grant.
- With that empty private schema added only to the synthetic scaffold,232 statements complete; `artists_added_by_created_at_idx` fails because the declared index applies `timestamptz_ops` to UUID column `added_by`.
- Testing stops there. The candidate is not executable end-to-end and must not be shipped or applied remotely as-is.

The bounded next implementation step is to review the fresh candidate's schema creation and index type mapping, regenerate from a corrected declared schema or an explicitly documented bootstrap-only transformation, and repeat the empty synthetic replay. Then separately inventory and include SQL-only functions/triggers/grants from the tracked chain (including0063 consumption triggers). A generated table/index/policy baseline does not contain those objects. No further historical or declared-schema repair was attempted in this audit.

Pinned full Web SHA: `d219118f1e3b9a0fa5c3807a8bf3ea4414fad99f`. Final candidate SHA256: `e123ad7bdd125c8aed597400c9e6101e6c46b1997d72248538bbf0513a8c5b5b`. The candidate lives under docs, outside the Drizzle migration directory/journal; no production config or test discovery configuration was changed.

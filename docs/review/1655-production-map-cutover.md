# Production map cutover candidate — 2026-11-06

The deployed Vercel Grapevine connection is operationally attributed to `webmapdata_editor` through two controlled health requests and successive matching statement-counter increments, corroborated by its retained map query shapes. This establishes a consumer, not exclusive use of the role. No secret was decrypted. Independent Express hosting remains unverified; the known production browser uses same-origin Vercel API routes.

## Concrete artifacts

- `docs/prototypes/guarded-about/productionMapCutover.sql`: generated, reviewable SQL stage. Requires the enclosing approved migration/legacy transaction; SAVEPOINT intentionally refuses standalone execution. It has no COMMIT and is not registered for automatic deployment.
- `productionArtistColumns.json`: exact observed production column order. All65 names/types match the existing contract; order differs from the Drizzle manifest. The builder permits only a bijective permutation of reviewed names/types and rejects catalog drift.
- `productionMapOperatorPreflight.sql` and `productionMapPostflight.sql`: role, membership, privilege and new-object ACL assertions. The read-only operator preflight passed against the live catalog; no DDL/grants were applied.
- Web commit `da3ba3dc19469d41d1579243b1916755fbec6aa2` in `/tmp/mn1655-web-managed-cli`: paired0061–0063 managed CLI guard correction. API copies/checksums match. Do not replay these revised historical migrations on Dev or alter its applied ledger.
- Grapevine local commit `36b3555bbb6065ebd79c91c7d99eb62a4f675eb5`: guarded literal reads and qualified existing writes. Not published/deployed.

Regenerate SQL from repository root by bundling `generateProductionMapCutover.ts` with the already-installed esbuild and running the resulting local module. A unit test compares the checked-in SQL exactly with the generator. Generation never connects to a database.

## Exact access effects

Create NOLOGIN/NOBYPASSRLS projection owner, private projector functions and guarded65-column view. Grant existing app and mapped map role SELECT on the view. Remove raw table SELECT from map/PUBLIC/anon/authenticated; retain map raw SELECT(id,name,webmapdata) for existing write predicates/results. Preserve existing UPDATE(webmapdata), RLS and all artist data. Add no profile-image UPDATE, INSERT, DELETE or anonymous view access. The existing map role has only UPDATE(webmapdata), so its profile-write attempts were already unauthorized; existing spotify_id/JSON cache and Express ORM mismatches remain baseline limitations, not repaired here.

Supabase platform/operator access remains explicitly trusted and unchanged. The official [Supabase initial schema](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql) provisions ETL/read-only roles with read-all authority. The [managed CLI role documentation](https://supabase.com/kb/troubleshooting/permission-denied-when-deleting-the-cli_login_postgres-role) identifies its administrative lifecycle. Live membership grantors and flags match those managed roles. Assertions pin the observed tuples and reject unrecognized incoming/assumable paths. This does not promise confidentiality against database administrators or managed replication/read-all operators.

Production postgres is not a superuser. Creating objects owned by the new projector requires temporary INHERIT and SET membership. Both are revoked and asserted disabled before this stage finishes; they cannot commit enabled on success. The creator retains PostgreSQL's ADMIN management capability and can re-enable membership, so the revocation is cleanup, not a new security boundary against the operator. Namespace checks accept only the exact managed CLI identity and preserve unrelated mn_private objects/USAGE.

Unexpected default grants on schemas, views, columns or functions abort instead of silently exposing the full projection. Unknown raw readers, inherited/SET ROLE paths, extra managed-role memberships, unsafe grant options and wider map writes also abort. Existing operator ACLs are not rewritten.

## Verification and limits

Column-order regressions failed before implementation. New target behavior is tested on an isolated socket-only native PostgreSQL17 cluster, including the nonsuperuser postgres owner. Tests cover visible evidenced bio, source withdrawal, preservation of stored text, original-order view, name-based cache writes, raw/private/profile/INSERT denial, atomic rollback, guarded NULL-bio fallback, temporary membership cleanup and independent default-schema/default-view/default-function rejection. The test entrypoint validates the owned cluster path, version, marker and disabled TCP before any fixture writes; the runner stops/removes only its own cluster.

The managed CLI namespace suite passed36PGlite and36nativePG17 cases. Generic projection/receipt suites are also rerun with updated fixtures. Earlier failing runs exposed fixture grantor/JSON-serialization mismatches and real nonsuperuser ownership requirements; these were corrected, not suppressed by extending timeouts or broad permanent grants.

No paid models, provider calls, hosted fixture writes, production DDL, grant changes, deployments or pushes were used. This is database/client-SQL evidence, not a new browser/deployed acceptance run. The original successful hosted About test belongs to its recorded earlier pair.

## Executable release order and remaining confirmations

1. Publish/review the corrected API/Web pair and the Grapevine client candidate when authorized. Pin exact deployment artifacts and confirm any other consumers sharing the map role; metadata does not prove exclusivity.
2. Establish the actual operator-controlled gate for public/regeneration traffic and ALL old writers/workers, including fixed deployment URLs and manual job producers. Record how to drain in-flight work and keep compatible deployments behind that gate. This note does not invent or execute a Vercel security-setting change.
3. With specific production authorization and a restorable backup, use one bounded transaction: load the already approved private16-snapshot manifest; run `legacy-about-preflight.sql` BEFORE0060 adds the publication column; apply reviewed0060–0064; run `productionMapCutover.sql`; run `legacy-about-activate.sql`; verify exact16, new objects and access postconditions; COMMIT. Any drift/error means ROLLBACK, never rehashing legacy evidence or broadening an allowlist.
4. Switch the exact paired API/Web, guarded Grapevine client and compatible workers while traffic remains gated. Verify preserved16, guarded search and intended cache-write behavior, then reopen. Do not expose the old raw-reading map in an unsafe mixed-version window.
5. Before commit, rollback restores prior objects/grants. After commit, preserve raw denial, text/evidence and consumed allowances. Use a reviewed compatible application pair or the guarded NULL-bio fallback; never restore raw SELECT or old unsafe binaries. The fallback sacrifices public About availability and is an explicit operational choice.

The next permission request should name the exact branches/artifacts, production migration/grant scope, gate/drain actions and fallback. No new product decision is needed to preserve the16; Pete already approved that policy. Production execution is not authorized by this local candidate.

## Final local results

- Full API suite: 5,004 passed,53 skipped; two additional native-only cases were subsequently added and passed in the native run. Final types, full/changed-file lint and full formatting passed.
- Target nativePG17:14/14 passed, including independent unexpected-schema-USAGE and default-view-SELECT rejection. The schema test injects a synthetic grant before postflight: native CREATE SCHEMA AUTHORIZATION uses the new owner's defaults, so a postgres-only default-schema grant did not propagate and is not represented as a real exploit.
- Broader nativePG17:30passed/2browser-only skipped; independent route persistence passed again, with identical mnweb readback after immediate restart. All disposable clusters stopped and removed.
- Managed CLI namespace:36PGlite/36native passed on the paired Web commit; target and migration exact-code review accepted after corrections.
- SQL SHA256: `c38e117436584cc2bcf5b7ee2f0ad3b77372eba30d3167e9542811950e555f0c`.

Local logs: `/tmp/mn1655-target-full.log`, `/tmp/mn1655-target-native-final.log`, `/tmp/mn1655-target-broader-native.log`, `/tmp/mn1655-target-types-final.log`, `/tmp/mn1655-target-lint-final.log`, `/tmp/mn1655-target-format-final.log`. No new build/provider/browser run was needed for these SQL/test-only changes; runtime application code is unchanged from the previously built main integration.

# Namespace repair and release preparation — 2026-11-05

Local candidate only; no push, migration, grant change, merge or deployment. This supersedes the namespace/source-checkpoint blockers in the preceding read-only readiness report, but not the unverified live-client mapping or release authorization.

## Implementation

Web0061–0063 preserve existing mn_private schema USAGE and unrelated objects. The migration operator must own the namespace and cannot be an app/public role. Nonsuperuser roles with effective CREATE or membership permitting SET ROLE to the owner/mnweb are rejected. Newly created About tables retain RLS and exact app grants; unexpected defaults/grant options fail atomically. Existing About name collisions still fail. No runtime permissions are expanded beyond the previously reviewed About object grants; public schema USAGE alone grants no access to those objects.

The production-shaped synthetic fixture reproduces observed ownership, schema ACL, unrelated tables and a callable definer function. It is an access-boundary rehearsal, not a reproduction of every existing publishing/moderation business function. Read-only production metadata found no dynamic EXECUTE, catalog introspection or About object mentions in the ten existing mn_private function bodies; that bounded scan is not a complete transitive call-graph audit.

API copies and checksums of0061–0063 were updated, including the atomic-writer receipt checksum and bootstrap input manifest. No compiled bootstrap function body changed. Drizzle table snapshots are unchanged because the schema shape is unchanged.

Dev already has the original0061–0064 under recorded applied migrations. DO NOT replay modified historical migrations or rewrite ledger hashes. Reconcile object definitions/ACL/RLS against their actual applied records; namespace preflight differences do not require recreating existing About tables. Production lacks these About objects and publication, so its reviewed install uses0060–0064 in order. A conflicting target shape must stop, not become IF NOT EXISTS adoption.

## Recovered exact16 checkpoint

Recovered from the original completed SQL and following manifest update in task 01a19e89-7c61-74c0-8593-505a7c07502b, turn01a1a79a-5105-72f8-ad20-8f1593e311c0. All16 stored hashes were privately compared with that history. Original expression:

```sql
encode(sha256(convert_to(coalesce((
 select jsonb_agg(to_jsonb(s) order by s.id)::text
 from artist_vault_sources s where s.artist_id=a.id
),'[]'),'UTF8')),'hex')
```

Read-only production recheck:16/16 source hashes match, as do artist existence, approved claim IDs, biography hashes and pin IDs. Connection settings were UTC and ISO, MDY; preflight fixes those settings. No source text, IDs or private hashes are included in Git. The manifest did not capture claim user_id or pinned-version text; do not invent those historical baselines or call them verified. Exact approved bios remain unchanged and no allowances were seeded.

The hash covers ALL source columns and rows. Therefore scripts/migrations/legacy-about-preflight.sql must run BEFORE0060 adds publication. It locks artist/claim/history/source tables against writes and verifies exact16 in the SAME transaction as migrations and activation. Do not subtract new columns or regenerate the approved hashes. The validated temporary table drops at commit, so scripts/migrations/legacy-about-activate.sql cannot replay the validation in a new transaction. Activation refuses existing allowances.

## Executable pieces and remaining release assembly

- `node --test scripts/migrations/about-namespace.test.mjs`: provider-free PGlite checks.
- `PG17_BIN=/absolute/official/pg17/bin node scripts/migrations/rehearse-about-namespace.mjs`: new isolated socket-only nativePG17 cluster, stopped/removed by the runner. Never accepts a connection URL or hosted credentials.
- `legacy-about-preflight.sql` and `legacy-about-activate.sql`: executable reviewed transaction stages; caller loads ONLY the private approved manifest into the documented temp table.
- API `docs/prototypes/guarded-about/rollback-public-bio.sql`: emergency NULL public biography fallback; asserts the expected view, projector owner/type and view dependency. Retains function ACL/owner, original artist text, evidence and consumed allowances. Native map-contract tests and PGlite regressions exercise it.

Production order after specific approval: gate affected traffic and every producer/old writer; drain in-flight work; BEGIN with bounded lock/statement timeouts; load reviewed manifest; run legacy preflight BEFORE0060; apply0060–0064; apply separately reviewed client/projection/grant cutover; activate exact16; run postflight; COMMIT; bring up exact paired production-configured API/Web and compatible workers behind gate; verify16 and intended clients/role behavior; reopen traffic/producers. No new reader may serve before activation.

This is not yet a single production-executable release command: a live-client-approved projection/grant artifact, actual gate/drain mechanism and compatible deployed rollback pair are still missing. Do not fill those steps with guessed role mappings. The existing guarded projection builder remains a tested prototype and refuses unknown readers.

Before commit, ROLLBACK restores original objects/permissions. After commit, do not replay old production builds, restore raw grants, drop sidecars or resurrect consumed allowances. Use the reviewed guarded fallback or a verified compatible pair while the affected path remains gated. The NULL fallback deliberately trades About availability for confidentiality and requires operational approval.

## Client facts and exact decision

Current Grapevine main remains the reviewed e95621f17fc2ed142a600031d7f6cf8a59a2b0b6. Historical issue391 identifies Carl as the creator of webmapdata_editor for Artist Web Map. Current production role/deployment credential mapping is still not proven. No secret values or contact with others was used to infer it. Needed from the current map maintainer (Carl is the documented routing contact): identify live deployment/role, accept guarded read relation changes and narrow existing map writes, confirm the spotify/spotify_id contract and cache invalidation. Preserve current access until that exact cutover is approved. No new decision is needed merely to preserve the unchanged16, which Pete already approved.

## Verification and local checkpoints

Web checkpoint: `f0ae763e4b1711bcdcdca0aaa2fdf0877a9085c3` (not pushed). API checkpoint is the commit containing this record. Independent exact-code review accepted the final owner-SET-ROLE and guarded-rollback checks.

-19 namespace/legacy activation checks passed on PGlite and nativePostgreSQL17.11. -30 broader nativePostgreSQL17 checks passed; two browser-only cases were not enabled in this SQL-focused rerun. Independent process readback matched after immediate database restart. -API full suite:4,987 passed,41 skipped; types, changed-file lint, formatting and whitespace checks passed.17 guarded full-shape/rollback tests also passed independently. -Web release/migration/transcript checks:135 passed; legacy allowance suite:10 passed. -An initial fixture-hash assertion caught the updated0062 checksum and was corrected. A later concurrent full run hit one unrelated five-second PGlite timeout; unchanged test passed in the complete isolated two-worker rerun. These failed results are retained, not silently rerun away. -No new application build/browser/provider test was necessary for the SQL/test-only correction; prior build/hosted evidence belongs to published heads, not these unpublished checkpoints.

Logs: `/tmp/mn1655-namespace-native.log`, `/tmp/mn1655-namespace-native-full.log`, `/tmp/mn1655-namespace-api-full-recheck.log`, `/tmp/mn1655-namespace-web-release.log`, `/tmp/mn1655-namespace-web-legacy.log`. No active synthetic cluster remains.

# About migration and concurrency: local PostgreSQL verification

Issue: MusicNerdWeb #1655. Verified locally on 2026-11-03; nothing released or applied to a live database.

## Private-sidecar revalidation

The current local revision replaces the unpublished public-column migration with private evidence tables. The earlier column-test report below is historical. Updated native PostgreSQL 14.18 run: **17 passed in 4.15 seconds**, including the existing multi-connection source/lease/authority races, private schema migration rollback under a history-table lock, and real anon/authenticated SELECT denial. Legacy public artist SELECT * still works and has no provenance field. A separate PGlite regression also checks an inherited anonymous role. Raw public bio access remains explicitly visible in this test and is a release gate, not evidence of safe public projection. The first native refactor run caught null legacy lineage being inserted into a NOT NULL sidecar; writers now represent legacy by absent rows. Independent review also found the reset flow lacked an early artist lock; the fix is verified by a real concurrent reset waiting for generation to commit, then backing up matching text and lineage. The temporary server was stopped after this final run.

Only PostgreSQL 14 is installed in the inspected local Homebrew locations; no PostgreSQL 17 server was available. No download, remote database test or live write was attempted. Target-equivalent PostgreSQL 17 verification remains outstanding.

## Environment and isolation

PostgreSQL 14.18 (Homebrew), initialized as a new disposable cluster under a private `/tmp/mn-1655-pg.*` directory. TCP listening was disabled; the Unix socket was permission 0700. No existing database service, application credentials, env file, remote source, storage service or model was used. The temporary server was stopped after verification.

The opt-in test is `lib/bio/__tests__/aboutConcurrency.postgres.test.ts`. It runs only with `MN_1655_PG_SOCKET` matching the disposable socket pattern, and always connects to database `mn_1655_synthetic` on that socket, port 55465. Before destructive fixture setup it verifies the database name, explicit `mn-1655-synthetic-only` database comment, canonical cluster data directory and disabled TCP. Default execution skips all 15 cases without connecting.

Setup creates an owner connection and a separate non-superuser, non-BYPASSRLS `mnweb` role. Fixtures use current Drizzle columns, simplified enum/default/constraint definitions, explicit required unique indexes and synthetic role-wide RLS policies. Application operations run as `mnweb`; an attempted ALTER TABLE by that role is rejected. This is not verification of the target environment's actual grants, policies or complete migration history.

## Results

Final native run: **15 passed in 3.95 seconds**. TypeScript and focused lint also passed. Only tests and this report were added; production application code was unchanged by this verification.

- Exact migration files `0060_source_publication.sql` and `0061_about_evidence_provenance.sql` applied to pre-change synthetic tables. Existing biography text and pinned history remained unchanged, with null provenance. Existing table grants permitted the application role to read the added columns.
- Two simultaneous lease reservations used **two distinct PostgreSQL backend sessions**. Exactly one acquired the lease; the other returned busy.
- Actual About persistence held source publication/moderation, retained trust-event and administrator-role updates until its transaction completed. The competing operations reached a PostgreSQL lock wait and returned the expected `55P03` lock timeout.
- After publication, making evidence private/rejected or removing trust-event attribution hid the public About without deleting stored text/history. Later contributor-role loss preserved immutable submission trust while preventing a new unauthorized regeneration reservation.
- Privacy/rejection committed first caused publication to fail with no partial About, Lore or history write.
- A claim-revocation transaction holding the artist row lock completed before a waiting publication; publication then rejected the changed ownership and retained the old bio.
- Actual `insertVaultSource` and `updateVaultSourceStatus` writers blocked newly inserted/approved evidence behind publication's artist lock. After they committed, the next About reservation required a Lore refresh. A new eligible source committed before publication instead caused the old manifest to be rejected.
- Competing expected-bio writes produced one success and one `BioConflictError`, preserving history without a lost update.
- An old lease token could not settle a replacement lease.
- The actual two-second About lock budget produced `55P03` without creating a stranded lease.
- With a concurrent transaction reading the history table, applying migration 0061 inside an explicit transaction with a short lock timeout rolled back **both** column additions when the second ALTER blocked. After releasing the blocker, the transaction succeeded and preserved text/pins. This checks a bounded transactional application strategy, not the behavior of an unexamined deployment runner.

Blocking was observed through PostgreSQL lock-wait state, not inferred only from a sleep. Publication barriers have bounded failure paths, and transaction holders release in `finally` blocks. Initial harness issues (the database-comment catalog function, an error-wording assertion and migration-test lifecycle placement) were corrected; none identified an application defect.

## Reproduction boundary

Use a newly initialized private, TCP-disabled cluster; create `mn_1655_synthetic`, mark it with the exact comment above, and create the restricted `mnweb` role. The harness intentionally recreates the marked database's public fixture schema. Never point it at application data. The checked-out Web migrations are read from `/tmp/mn-about-trusted-web/drizzle`.

From this API worktree, with Node 24 and existing dependencies:

```sh
MN_1655_PG_SOCKET=/tmp/mn-1655-pg.REPLACE \
  node node_modules/vitest/vitest.mjs run lib/bio/__tests__/aboutConcurrency.postgres.test.ts
```

Stop only that recorded disposable cluster with `pg_ctl` after the run, including on failure. The test closes its connections but does not manage the server process.

## Remaining release gates

1. Verify the actual target PostgreSQL version, schema, migration ordering, `mnweb` privileges and RLS using the approved staging/release process. Plan a bounded transactional migration window; no target database was accessed here.
2. Coordinate API and Web rollout after the additive migrations. Old readers ignore provenance and old writers may create untracked history; a mixed-version deployment cannot guarantee the new privacy behavior.
3. Exercise the real authenticated UI, source extraction, model deadline/failure and storage flows in an authorized environment. These tests use synthetic readable evidence and call no providers.
4. The revocation test validates its artist-lock/status-change protocol, not the complete revocation cleanup function or physical object lifecycle. Pin/history behavior remains covered by the earlier unit/PGlite checks, not a native concurrent Web pin test.
5. Legacy null-provenance text retains claimed-only behavior; historical evidence cannot be reconstructed honestly. Existing third-party cached content cannot be recalled by this change.

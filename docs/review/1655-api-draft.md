# Draft API PR — local, not published

Title: Prepare About from eligible Lore with source-safe publication

When an authorized editor regenerates About with eligible Lore but no document, prepare Lore first using the existing job slot. Reuse a current document, refresh stale eligible sources, and revalidate source revisions, actor authority and lease ownership before publishing. Errors preserve existing About and distinguish Lore preparation from About failure.

The coordinated Web dependency stack includes trusted-source publication, private biography/history evidence, URL receipts and preservation through setup/revocation. Contribution eligibility does not grant About editing. Migration 0064 is required before this API: its private lock-only helper avoids granting the app event UPDATE permission while preserving concurrency protection.

Validation: genuine hosted login plus two synthetic UI regenerations passed, covering missing and existing Lore with persisted evidence/history and source preservation. Local checks passed: 404 Lore/About tests, 90 adapter tests, 32 native PostgreSQL/browser tests, restart durability, nine least-privilege checks, types and changed-file lint. Full local API CI commands subsequently passed: types, lint, formatting, build and 4,985 tests (41 skipped). Web passed 3,768 tests and 116 release regressions. Native acceptance passed all 32 tests and restart readback on an isolated rerun after one setup-browser timeout under parallel load. Fresh dependency installation and hosted CI remain unverified. Exact provider charges were unavailable; no zero-cost claim is made.

Refs xdjs/MusicNerdWeb#1655. Link the paired Web draft and endpoint documentation. Keep the PR draft pending production migration reconciliation, raw-reader cutover, exact-16 legacy activation and compatible rollback review. Do not auto-close before production release acceptance. See the final compatibility review for precise scope, evidence and CI requirements.

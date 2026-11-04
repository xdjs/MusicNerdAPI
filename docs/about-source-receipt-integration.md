# Source receipt writer integration — #1655

Superseding user decision (2026-11-04): [preserve the exact 16 legacy snapshots](about-legacy-snapshot-exceptions.md) through explicit private snapshot permissions, not a blanket claimed-bio fallback. Earlier statements requiring approval to hide all 16 are historical and no longer the plan. New or changed content remains guarded.

2026-11-04 legacy-policy update: [strict public lineage policy](about-legacy-publication-policy.md) removes the earlier claim-only legacy exception in the local candidate. Raw text/history is preserved; production visibility approval is still required.

Local implementation and verification, 2026-11-04. API/Web branches: `codex/about-trusted-integration`. No live migration/grants, deployment, publication or paid/model calls occurred. This supersedes earlier documents saying receipt preparation exists only in a test decorator.

## Implemented behavior

API `prepareBioUrlReceipts` prepares accepted source URLs through the current/history writer's own transaction. `writeBioProvenance`, `saveBioVersions`, the explicit unchanged-text publication path and correction writes use it. Web `recordBioSourceUrlReceipts`/`recordSourceUrlReceipts` cover current provenance, history/deduplicated saves, explicit saved versions, pins, explicit unchanged edits and revocation history preservation. Standalone Lore source storage is unchanged: receipts certify URL policy for published About lineage, not source approval or research completion.

Only supported version-1 generated/authored lineage supplies receipt URLs. Each distinct URL is checked by the existing application URL validator and encoded without normalization. NUL/unpaired UTF-16 or policy-rejected historical URLs receive no receipt; authorized edits still preserve their text/lineage. Accepted URLs are stored by SHA-256 and policy version 1, then read back and compared with the exact original UTF-8 bytes. A collision/conflict, missing receipt or storage failure aborts the entire text/history/provenance/lease transaction. Driver errors are replaced with sanitized errors so SQL parameters containing historical private URLs do not reach caller logs.

URLs are sorted within each helper call. Idempotent concurrent same-URL publication works. Separate old/new history batches can still deadlock across artists; PostgreSQL aborts one transaction and the application reports failure without partial publication. This is not an automatic retry guarantee. Receipt rows are private and may outlive source removal; source eligibility/revision/claim checks still run on guarded reads, so a retained receipt cannot keep withdrawn evidence public.

Pure reads never create receipts. API's pinned regeneration returns unchanged without backfill. Web's explicitly authorized unchanged/pinned edit may prepare its retained current/history receipts without changing text. Neither behavior is an automatic historical backfill. Existing lineage, pins and no-op reads require an explicitly scoped backfill/coverage check before SQL-reader cutover; no provenance is invented.

## Schema and deployment dependency

Web migration `0062_public_url_receipts.sql` follows private sidecar migration 0061. It creates `mn_private.public_url_receipts`, primary key(hash,policy_version), fixed 32-byte hash/positive version checks, exact C-collated URL text, and RLS. mnweb has SELECT/INSERT only, without grant option; unexpected schema/table defaults/direct ACLs abort. Role inheritance remains an explicit release-preflight audit. Schema, journal and snapshot are in step. There is no data backfill or future projection-role grant.

New API/Web writers require 0062 before rollout. Apply the reviewed migration transactionally while respecting the existing paired-deployment gate. Do not deploy a new writer against an old schema. Existing app public readers remain the JavaScript evidence projectors; SQL projection cutover is still a separate explicitly approved action.

The prototype's `useExistingUrlReceipts` adapter now validates an existing 0062 table's columns/types/nullability/collation/PK/checks/RLS/policies/table and column grants before adding only dedicated projection reads. It replaces duplicate table creation; it does not blindly use IF NOT EXISTS or weaken the unknown-reader preflight. The actual writer + actual 0062 migration + guarded reader test now uses this path without a writer decorator. Default API tests use a repository-local exact migration fixture; reviewed SHA-256 matches Web0062: `08c57527024da5dfce4bf943fab374b8ae11acb381a98db4ba813508d7aabf53`.

## Verification

- API: **4,821 passed, 28 skipped** across 962 suites; full TypeScript/lint and offline webpack build passed. Focused actual-writer/guarded-receipt tests also passed after making the migration fixture portable.
- Web: **3,749 passed, six skipped** across 433 suites; additional pinned-edit focused file nine passed (added while the full run was underway, so not counted as full-suite coverage). Types, lint, schema snapshot parity and production build passed. Build used an empty environment plus documented Spotify stub values; sitemap attempted an unconfigured local database connection, received EPERM and used its existing fallback. No live database/provider verification is implied.
- Native PostgreSQL 14.18: **19 passed in 4.12s**, final rerun after cleanup hardening. Actual0060/0061/0062 migrations, distinct backend sessions, shared-receipt two-artist contention, idempotency, mnweb permission limits, direct public denial, conflict rollback, existing source/claim/lease races and bounded lock failure all passed. Only the existing marked synthetic database on a private Unix socket was used; TCP disabled. The server was stopped after verification.
- Independent exact-code review cleared API/Web receipt privacy/atomicity, migration access limits and existing-table projection reuse. It found and prompted fixes for URL-bearing driver-error leakage, a nonportable test migration path and contention-test cleanup.

No installed PostgreSQL 17 runtime was found in the inspected local inventory. Homebrew provides 14.18; Docker daemon is unavailable. No installation, container pull or daemon startup occurred. Native 14 and PGlite do not substitute for native 17 or hosted API/schema verification.

## Remaining release gates

1. Identify/approve actual raw-reader consumers and their qualified relation/write/RETURNING contracts. Missing logs do not establish disuse. Keep the existing fail-closed compatibility preflight.
2. Approve full-row audience and migrate clients to the guarded interface; preserve target-specific Dev/production behavior and existing map-edit constraints.
3. Prepare and verify an explicit exact-byte receipt backfill for intended existing biographies, without altering historical evidence or calling models. Keep invalid/unknown evidence hidden.
4. Verify native PostgreSQL 17 and authorized isolated deployed API/UI/Data API contracts, then rehearse paired rollout and fail-closed rollback.
5. Owner review/sign-off and separately authorized release. This local integration does not close the issue or mark production fixed.

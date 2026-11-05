# Release review checkpoint — 2026-11-05

## Exact scope and evidence

API baseline main: `4f7c2705bde7545c53270fbd732d804aa5d7ca77`. Web baseline main: `03b2d9a556644d4ec7121fca398977057ad8c90f`. Both were verified unchanged with read-only remote checks on 2026-11-05.

The staged API was commit `7c0f9c031cf93b780c3afa005b1a535667737d4c` plus the tested change to `assertLoreSourcesCurrent.ts` (SHA-256 `7487c7d66af6c763e3c72f8ce33fd45dbc134c5b7bbb332cde3ede5514b7a63a`). Staged Web application code was `313a9069dd20a4bcda76448fd16b9d591176a56b`, with a deployment-only API URL pairing. Web checkpoint `2957b9bec0a5c730d39bfff09a4f76ec18d4f96e` adds migration 0064 and review documentation, not application changes. The API commit containing this record checkpoints the tested correction and fixtures; staging used CLI source archives, not Git-linked deployment metadata.

Migration 0064 SHA-256: `3b2ec181364f3f414ee9f73a920716546fec3c68b23a62c3cc22386ee652b0e0`. It creates one controlled-owner, void-returning SECURITY DEFINER function with fixed search_path, grants only mnweb EXECUTE, and fails on collisions/unexpected ACLs. It grants no event UPDATE/DELETE. Source rows lock before referenced events; ordinary-role eligibility/revision checks remain unchanged.

This is an accumulated coordinated stack, not an endpoint-only PR: trusted uploads/revocation preservation, source publication, private evidence/history, URL receipts, public readers, setup and test harnesses are included. Before the final correction, the API branch already changed 302 files. Review dependencies explicitly; extraction requires retesting.

## Actual staging result

The approved test used existing Dev, additive migrations 0061–0064, ordinary API/Web previews and one synthetic artist/source. No new database, database credentials, subscription, production deployment or shared alias change was made. Genuine test-account login sessions did occur.

The first earlier attempt exposed PostgreSQL 42501: event-row locking required permission absent from the actual app role. It preserved About; its synthetic job was made terminal to prevent retries. Native tests were corrected to reflect the real SELECT/INSERT-only event grants.

After the reviewed 0064 correction, genuine Privy login, Web callback and bearer own-account/admin verification succeeded. Optional username setup writes remained blocked. Two deliberate UI regenerations returned HTTP 200:

- Missing document: Lore and About persisted; one source, evidence and receipt retained.
- Existing document: About regenerated; document hash and timestamp were unchanged.

Readback confirmed three history rows, the original About retained in history, two history-provenance rows, a current provenance row, one URL receipt, source preservation, two completed retry jobs, and zero pending/running fixture jobs. Runtime logs showed two PUTs and one Lore rebuild. The synthetic fixture and terminal jobs remain for review; no permanent deletion was performed.

Four logical generation operations completed in this successful retry, following two Lore operations in the earlier failed attempt: six logical operations across both attempts. Exact gateway retries, token counts and billed cost are unavailable because scoped metrics require paid Observability Plus, which was not enabled. The earlier estimate was not a verified charge. No request outcome remains uncertain.

## Local verification and CI

- 404 focused Lore/About tests passed; the native-only file is exercised separately.
- 90 adapter/bootstrap tests passed.
- 32 native PostgreSQL 17.11 tests passed with both browser suites enabled, including actual routes, source relinking, restricted-role behavior and failure preservation.
- Independent process readback was identical after immediate PostgreSQL restart.
- Nine native least-privilege/migration checks passed; fresh bootstrap passed.
- API TypeScript, changed-file ESLint and whitespace checks passed.
- Independent exact-code review accepted the locking correction; default-ACL and bootstrap dependency findings were fixed and retested.

These are scoped results, not a claim that full CI has passed on the final checkpoint. API CI still needs frozen pnpm installation on Node 24, full type/lint/format/test and build. Web CI needs its pinned Node/npm installation, types/lint/test:ci, release/migration regression tests and build. Native PostgreSQL/browser tests are opt-in and are not automatically exercised by the default unit command; run the provided native harness with PostgreSQL 17, both browser flags and the paired offline Next artifact. Review the disabled PG17 workflow before enabling it; do not assume hosted CI already ran it. Do not use real provider credentials for offline checks.

## Production dependencies — not proved by staging acceptance

1. Reconcile target migration shape and ledger. Dev already had publication, so 0060 was not blindly replayed. Production needs its own read-only comparison. Apply private structures and 0064 before compatible writers; do not mark unexplained drift as applied.
2. Raw database readers can bypass guarded application projections. Known custom roles and inherited/view/RPC access require an explicit client/grant cutover. The guarded relation and Artist Web Map compatibility remain reviewed prototypes, not an installed production solution. Missing usage logs do not prove disuse. Keep the cutover preflight fail-closed while unknown raw-reader paths remain.
3. Preserve the user's exact 16 claimed legacy bios. Before new readers receive production traffic, validate the approved artist/claim/text-hash snapshots against current state and activate only matching allowances. A mismatch stops that activation; do not broaden trust or fabricate evidence. Migration 0063 seeds no rows. Allowances are consumed on relevant claim, text, source or provenance changes.
4. Coordinate API, Web, workers and older previews. Old writers do not maintain complete receipts; old readers ignore evidence. The admin synthetic test does not establish hosted claimant onboarding, full research quality, every external client or safe mixed-version production operation.
5. Prepare a compatible guarded rollback pair and explicit gate/drain procedure. Retain evidence, receipts, consumed allowances and approved raw-read restrictions. Never roll back to old unguarded readers, restore broad raw grants, resurrect consumed allowances or drop the helper while new callers use it. Dropping 0064 fails closed; restoring the old API reproduces the permission failure.

## Concrete next step

Review the paired local draft PRs and dependency stack, run full CI plus the opt-in native acceptance on the checkpointed pair, and finish the production raw-reader/legacy activation plan. Publication is a separate approval step; no push, PR publication, merge or production release was performed. The staging bug acceptance is complete and does not need another paid retry merely to prepare review.

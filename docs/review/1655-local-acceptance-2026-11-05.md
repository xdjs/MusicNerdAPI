# Local acceptance and remaining hosted scope — 2026-11-05

No shared database, credential, deployment, provider or production change was made. The native harness uses an owned temporary Unix-socket-only cluster and removes it after shutdown. Tests are synthetic; existing hosted real-Privy evidence remains separate.

## New checks

- Native PostgreSQL 17.11: 28 tests, including real transaction races, preservation, source withdrawal, authorization and migration behavior. The new test invokes the actual PUT/GET route handlers with distinct Request objects, an actual mnweb database connection and real account/claim authorization. Only the external Privy verifier and three generation functions are replaced. It is not an HTTP listener or browser test.
- The new route sequence denies a regular contributor, approves a synthetic claim, creates missing Lore, reuses the current document, reads the persisted About, preserves text after About failure and Lore preparation failure, verifies lease release to a retryable pending job, then succeeds on retry.
- The runner repeats that one route fixture, reads committed records from a separate psql process as mnweb, stops PostgreSQL immediately, restarts with TCP still disabled, verifies database/version/canonical data directory, and compares complete synthetic About, Lore, history, provenance, receipt, source and job records. This is local WAL recovery, not hosted durability or power-loss/hardware testing.
- 313 provider-free tests passed across 65 API/domain/prototype suites using the deny-network preload; the 28 native tests skip in that non-native run and are executed separately above. API TypeScript and scoped ESLint passed.
- Paired Web: 246 tests across 20 suites, TypeScript and offline production build passed. Existing warnings remain. See the Web evidence document docs/testing/local-1655-acceptance-20261105.md. UI fetch/auth mocks do not establish browser-to-API HTTP integration.

The initial route assertion wrongly expected no pending job after Lore failure. The implementation intentionally releases the lease and increments attempts; the corrected assertion checks no running lease, pending attempts=1, claimed_at=null and successful retry. No application change was needed. The first restart invocation omitted startup options and failed to start; the runner now repeats all socket-only options. Its additional path assertion initially compared macOS /tmp with canonical /private/tmp; both paths are now canonicalized. These were harness issues, not product failures.

Logs: /tmp/mn-1655-pg17-restart-final.log, /tmp/mn-1655-local-domain.log, /tmp/mn-1655-local-types.log, /tmp/mn-1655-local-lint.log. Assertions use a reduced synthetic schema; missing optional research tables can take their existing catch/fallback paths. This does not prove full research ingestion.

## Minimum remaining integration

Local route/database and Web contracts are verified separately. A complete local browser Web→API run would require a reviewed test-only Web authentication boundary and synthetic-only Web database binding. Do not add a production auth bypass or treat an invented token as real authentication evidence. Previously recorded hosted Privy tests prove the real token/role boundary, but used request-local fixture storage.

For hosted cross-request persistence, reuse existing infrastructure only after explicit permission for a disposable Dev logical database and restricted expiring login. No permission is being requested or exercised here. A protected fixed-adapter preview would seed once outside requests, perform write/read from separate HTTP requests, restart/redeploy only the test application, and read again without reseeding; include failure preservation and cleanup. Actual pooler custom-database/login isolation must pass before fixture writes. This does not establish managed Supabase Data API services.

Shared staging migration remains a distinct step: reconcile the existing publication column/ledger; review additive private tables and legacy invalidation triggers; verify existing mnweb grants; prevent shared research workers consuming synthetic jobs; keep unknown raw-reader permissions unchanged until the compatibility cutover decision. Do not claim final biography privacy while raw-reader bypasses remain.

## PR preparation

Linked API, Web and endpoint-docs drafts remain local. Current-main reconciliation is recorded in the handoff. The accumulated candidate includes trusted-source/evidence/upload-fencing prerequisites and must not be presented as a tiny endpoint-only patch. Full repository-wide API gates and a complete hosted Web flow are not newly claimed. Owner acceptance, PR publication, shared migration and production release remain separate steps.

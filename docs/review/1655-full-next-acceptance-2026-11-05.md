# Full local profile and onboarding acceptance — 2026-11-05

All 30 tests passed with both browser suites enabled against isolated native PostgreSQL 17.11. No shared staging, production, credentials, providers or hosted resources were changed.

## Coverage

- Actual Next profile page, setup arrival/start/polling, API setup stages and database persistence with deterministic external boundaries.
- Regenerate About, manual edit/save, history pin and reload using actual Next server actions.
- A second setup pass preserves the exact manual About, complete history and pin, Lore content/sources, full trusted source row and pending contribution moderation status. Generation counters do not increase on that preservation pass.
- Explicit successful authenticated GET responses for Latest status and research discoveries; both are database-only reads.
- The focused browser suite covers missing/existing Lore documents and prerequisite/About failures with preserved existing content.
- Native concurrency, provenance and authorization regressions remain included.
- Local non-superuser bootstrap rehearsal passes standalone database creation, temporary owner membership, revocation, fresh-session denial checks, allowed writes/locks and exact cleanup.
- An independent mnweb process reads identical About, Lore, history, evidence, source and job snapshots after immediate PostgreSQL shutdown and restart/WAL recovery.

## Reproduce

The paired Web repository's `docs/testing/local-1655-next/create.mjs` creates an isolated artifact. Build it offline as described there. The verified artifact for this run was `/tmp/mn-1655-next-Av488Y`.

```sh
MN_1655_FULL_NEXT=yes MN_1655_BROWSER=yes \
MN_1655_NEXT_ARTIFACT=/tmp/mn-1655-next-Av488Y \
MN_APPROVED_SYNTHETIC_PG17=yes \
PG17_BIN=/tmp/mn-pg17-build/runtime/bin \
NODE24_BIN=/Users/peterarango/.nvm/versions/node/v24.16.0/bin/node \
bash docs/prototypes/pg17-ci/run-native-pg17.sh
```

Local log: `/tmp/mn-1655-complete-local-final.log`. Initial suite: 30/30; independent route reseed: 1 selected test passed; role rehearsal passed; restart comparison passed; owned cluster stopped and removed. API `tsc --noEmit`, scoped ESLint and runner syntax checks passed. The isolated Next production build passed offline with lint/types before this execution. No application source changed in this checkpoint.

## Limits

Authentication/session and model/discovery boundaries are synthetic in this local run. Earlier hosted authentication evidence is separate. Workflow hosting is replaced with local execution; hosted durability/retries and real provider quality are not proven. The extended Web schema is a synthetic compatibility fixture, not a full production constraint/RLS replica. Bootstrap grant rehearsal uses a reduced fixture, not the entire app migration contract.

The browser checks preservation after setup completes; it does not establish visibility during pending research. Exact Google favicon requests receive a local SVG. Only Next prefetch 404s for four deliberately omitted pages are separately counted; all other HTTP errors and browser exceptions fail. Those unrelated pages are not covered.

The hosted database creation path remains unverified as recorded in `1655-hosted-feasibility-2026-11-05.md`; passing local tests does not authorize or prove hosted creation/pooler authentication. Do not change unknown-reader grants on this evidence.

# Provider-free About workflow harness

Local verification for #1655, not a staging deployment or full end-to-end test. Run with existing Node 24/dependencies from the API checkout:

```sh
node node_modules/vitest/vitest.mjs run docs/prototypes/synthetic-about/generation.test.ts
```

Each serial test creates a fresh **in-memory PGlite** database, uses the same synthetic artist ID, and closes the database in teardown. No connection URL, application credential or filesystem database is used. Sixteen artists would not add coverage: sixteen scenarios can instead reset one isolated fixture, provided no work survives between cases. Two simultaneous requests deliberately target that same artist when testing lease admission.

The real `generateArtistBio` orchestration calls actual Lore preparation, reservation, source eligibility, database authorization, Lore persistence, About persistence, history and private provenance helpers. The three model-facing Lore synthesis/summary/About functions are stubbed; prompt composition, actual model SDK deadlines/retries and billing are therefore outside this test. Unused social channels are empty stubs. Unexpected fetch calls throw and are asserted absent; this is a test guard, not an operating-system network firewall. The application database module is replaced before importing generation code.

Schema scaffolding uses the pinned Drizzle columns with the unique constraints needed by these workflows. It does not reproduce all production constraints, RLS, migration history or native PostgreSQL locking. Do not treat a passing PGlite run as native PG17, role-grant, migration or cross-session concurrency proof. Existing native PostgreSQL tests remain separate and opt-in; this command does not start or connect to that cluster.

Verification on 2026-11-03: **11 tests passed in 5.04 seconds**; full API TypeScript checking and targeted ESLint passed. Independent exact-code review found no blockers. Its teardown-hardening suggestion was applied and the 11 tests rerun successfully. This pass changes tests and planning documents only, not application behavior.

The harness checks successful missing/current/stale Lore flows, preservation on failure, absence of model work when unusable/unauthorized/busy, and evidence withdrawal before publication. Exact executable cases and assertions are in `generation.test.ts`. Model counters count calls to stubbed workflow boundaries, not provider requests. Public-read assertions use the real application helper, not a deployed HTTP/database API.

No fixture cleanup can touch a shared database: the only database is constructed without a path or connection string and destroyed by closing its in-memory instance. Teardown also restores global mocks. Deterministic request barriers must release and await all pending calls before teardown, including failed assertions.

Remaining staging work: real token authentication/UI, actual API response integration, native PG17 and full migrations/RLS, fault-injected settlement/deadline recovery, legacy/pin/onboarding/revocation variants and direct-reader compatibility. Use `../../about-synthetic-staging-proposal.md` for the separately approved deployment plan; no deployment or paid call is authorized here.

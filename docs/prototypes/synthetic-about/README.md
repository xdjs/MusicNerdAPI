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


## Fixed synthetic About acceptance preview

This separately bundled test application runs the actual About PUT/GET route using real staging Privy verification, three deterministic generation adapters, and a fresh request-local PGlite database. It does not replace or relax the strict credential guard used by the shared-database test design.

`prepareSynthetic(sourceRoot, parent, subjects)` creates a disposable Next project. `subjects` is a server-only map from approved test subject SHA-256 hashes to synthetic admin flags. These flags are fixture roles, not a live-role lookup. The fixed ordinary-user scenario first requires 403, then adds an approved claim in its disposable database and requires success. Neither role assignment nor claim is written to staging.

The endpoint rejects request content and query strings. Authentication and the fixed subject allowlist precede database creation. Each request seeds one fictional artist and one approved public source, generates missing Lore and About, regenerates About using existing Lore, and reads the persisted synthetic About. The database and adapter counters use AsyncLocalStorage; cleanup closes the database in `finally`. There is no durable state across requests.

Build verification checks the emitted route and module closure, preserves the genuine token verifier, excludes original model implementations/provider SDKs/shared PostgreSQL driver, and bootstraps the SQL in PGlite. The dependency lock is pinned; installation disables lifecycle scripts. Deploy only the generated source, excluding node_modules, .next, .env files and logs. Link the existing API project; use Preview without changing shared aliases. Blank non-Privy application credentials using deployment-only overrides. Preserve the existing staging Privy app credentials, never copy or print their values.

### Trust boundary and limits

The host can retain platform OIDC and automation capabilities. This is a trusted, reviewed application with synthetic artist content; it is not an OS-enforced egress sandbox or a claim that the host contains no credentials. The only intended external service use is genuine Privy verification. SDK dependencies remain trusted. Console suppression avoids application error payloads but cannot guarantee platform-level logging behavior.

The two-request capacity bound is process-local. A platform hard timeout can prevent `finally` cleanup; an interrupted ephemeral database cannot change shared state. PGlite is PostgreSQL 18.3/WASM, not the separately tested native PostgreSQL 17 runtime. Hosted acceptance does not prove live Supabase grants, shared-database concurrency, cross-request persistence, real generation quality, current live account roles, or full onboarding.

Use only the two approved test accounts through their documented normal login flow, isolated from existing browser sessions. Keep SDK tokens in memory, do not capture screenshots/traces/storage state, and stop if account linking, wallet creation or additional setup appears.

Local verification: `vitest run docs/prototypes/synthetic-about/generation.test.ts docs/prototypes/synthetic-about/__tests__/acceptance.test.ts` (20 passed); TypeScript no-emit and scoped ESLint passed. Hosted evidence is recorded separately after execution.

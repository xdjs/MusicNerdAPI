# Focused local browser acceptance — 2026-11-05

This extends the earlier separate Web/API checks into an actual browser → Web component → HTTP API → native PostgreSQL flow. It does not claim the entire Next artist page or onboarding flow.

## Exercised path

A fresh Chromium context renders the real Web BlurbSection, requestArtistBioUpdate and useArtistBio in a standalone local test bundle. Clicking Regenerate sends one actual PUT with the same request body and bearer-header contract as the application, including browser CORS. A loopback-only transport forwards the request to the unmodified API route handlers. Real account/claim authorization, Lore preparation, eligibility, lease handling and persistence run against the owned native PostgreSQL 17 fixture as mnweb.

The bundle replaces only external/context dependencies needed for this focused surface: synthetic Privy token acquisition, authorized edit context, navigation, toast presentation, unpinned history and correction dialog. API verification maps that nonsecret fixture token to a synthetic user; it does not bypass canEditArtist. Three generation functions use deterministic adapters. These adapters are build/test-only and no production entrypoint imports them.

## Assertions

- Missing Lore: claimant clicks Regenerate; HTTP 200, one Lore synthesis and one About generation; textarea updates.
- Existing Lore: a fresh browser invocation clicks Regenerate; HTTP 200, cumulative one Lore synthesis/two About generations, proving document reuse.
- About failure: error response and useful About-specific toast; previous text remains visible.
- Lore preparation failure: prerequisite-specific error; no About model call; previous text and history remain unchanged; no running lease remains.
- Every scenario clears localStorage, reloads the page, performs an actual public GET and verifies the saved biography in the textarea. Exactly one PUT per click, expected bearer/body, no browser page errors and no attempted out-of-allowlist browser requests are asserted.
- The suite then independently repeats the route fixture and verifies identical committed records after an immediate PostgreSQL restart, using a fresh mnweb process. That restart read is SQL, not a post-restart browser read.

## Boundaries

The initial editor text is a synthetic prop, because legacy text without provenance is not necessarily public. Later reloads obtain their text from the actual public GET. The wrapper sets edit permission true and history reports unpinned; full profile initialization, real pin UI, correction dialog, navigation and onboarding are not covered here. Prior hosted evidence covers real Privy login separately. The loopback HTTP transport does not propagate client disconnect into Request.signal, so this is not cancellation validation. Browser routing blocks nonlocal page requests but is not an OS-wide egress sandbox. No provider calls or shared records are used.

Native schema is synthetic and reduced; optional research tables may take existing fallback paths. This test is not a complete research-pipeline rehearsal, hosted permissions test or model-quality assessment.

## Reproduction

From the API review worktree, with the paired Web review worktree at the fixed local test path and existing dependencies/browser installed:

```sh
MN_1655_BROWSER=yes MN_APPROVED_SYNTHETIC_PG17=yes \
PG17_BIN=/tmp/mn-pg17-build/runtime/bin \
NODE24_BIN=/Users/peterarango/.nvm/versions/node/v24.16.0/bin/node \
bash docs/prototypes/pg17-ci/run-native-pg17.sh
```

No install or external service is required. The database uses only a private Unix socket; the temporary Web/API listeners bind 127.0.0.1 at fixed ports. A conflicting listener causes failure, not reuse. The harness does not load environment files or create real credentials.

Latest run: 29 native tests passed, including the four browser scenarios, plus the separate restart check. API types/scoped lint passed. Log: /tmp/mn-1655-browser-acceptance-final.log. Final rerun passed after independent review and the cleanup fix. The Web self-test separately verified SIGTERM and SIGINT after browser startup: owned browser PID gone, listener closed, temporary directory removed. Interruption during startup and forced SIGKILL are not covered.

## Remaining hosted test

No shared staging action was taken. The smallest hosted follow-up remains a protected fixed-generation preview against one approved disposable logical database in existing Dev, with operator-only seed/cleanup and an expiring restricted login. Before any creation, review the exact database/login scope and prove pooler support and denial of shared application reads. Independent HTTP requests must observe persisted state without reseeding. A full shared-staging rehearsal additionally needs reviewed migrations/role compatibility and exclusion of synthetic work from normal research workers. These are distinct from this successful local focused browser flow.

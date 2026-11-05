# Draft API PR — local review text, not published

Title: Prepare About from eligible Lore and preserve contributed evidence

An artist with readable eligible Lore but no generated document currently receives LORE_REQUIRED. The candidate prepares that prerequisite in the existing Lore job slot, then generates and saves About. It reuses a current document, refreshes stale eligible evidence, and checks authority, source revisions and lease ownership before publication. Failures preserve the previous biography and distinguish prerequisite preparation from About generation.

The coordinated candidate also writes private evidence/history and URL receipts atomically. This requires the matching Web schema/public-reader changes and the agreed source-publication policy. Contributor trust does not grant About editing or regeneration authority.

Validation: provider-free tests, native PostgreSQL 17 transactions/concurrency, and a hosted Linux fixed-fixture preview with real Privy login for both approved identities. The ordinary-user fixture was denied before a synthetic claim and succeeded afterward. Hosted missing/current Lore and readback passed. These results do not prove live Supabase permissions, durable hosted storage, full onboarding, or real model latency/quality.

Review boundary: do not publish the entire accumulated integration branch as a small endpoint patch. Reconcile current main and identify the trusted-source/evidence prerequisites explicitly; keep unrelated revocation cleanup and test-deployment tooling out of the application PR unless a direct dependency is demonstrated. Link the Web draft and API endpoint-docs change required by repository guidance. Use "Refs xdjs/MusicNerdWeb#1655", not an automatic close before release acceptance.

Release remains blocked on the catalog/client migration and the durable integrated rehearsal described in docs/about-1655-acceptance-after-hosted.md. No production release is claimed.

Current local review branch: `codex/1655-api-review-20261105`, based on fetched main `4f7c2705bde7545c53270fbd732d804aa5d7ca77`. Paired Web branch: `codex/1655-web-review-20261105`. See `1655-review-handoff-2026-11-05.md` for exact checkpoints and durable rehearsal scope. The current accumulated branch includes upload/revocation-fencing prerequisites; these require explicit review or extraction before publication, not omission from the PR description.

Endpoint documentation text is prepared locally in `1655-endpoint-docs-draft.md`; it has not been published in the separate documentation codebase.

Local acceptance update (2026-11-05): 28 native PostgreSQL tests plus independent-process recovery readback; 313 offline API/domain/prototype tests; paired Web 246 tests, types and offline production build. Actual native route handlers were called with separate Request objects, not browser HTTP. See `1655-local-acceptance-2026-11-05.md` for commands/evidence, harness corrections and remaining end-to-end limits. No shared database or credential was created.

Later local browser acceptance now connects the actual About component to the real API route over HTTP and native PostgreSQL: missing/current Lore and both failure-preservation paths passed, including cache-cleared public GET reloads. This supersedes the earlier focused browser gap, but not full Next-page/onboarding or real hosted durability. See `1655-browser-acceptance-2026-11-05.md` for exact test-only adapters and limits.

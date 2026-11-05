# Draft API PR — local, not published

Title: Prepare About from eligible Lore with source-safe publication

When an authorized artist editor regenerates About with eligible Lore but no document, prepare the document first using the existing Lore job slot. Reuse current documents, refresh stale eligible sources, and revalidate source revisions, actor authority and lease ownership before publishing. Failures preserve existing content and distinguish Lore preparation from About failure.

This is a coordinated dependency stack with the Web candidate: source-publication eligibility, atomic private bio/history evidence and URL receipts, setup preservation, and trusted-upload/revocation prerequisites are included. Trusted contribution permission does not grant profile editing or About regeneration permission. Do not describe the accumulated diff as an endpoint-only patch.

Validation: 30 native PostgreSQL 17 tests with both browser suites enabled; actual Next setup, regeneration, manual edit, pin/reload and second-pass preservation; failure/concurrency cases; local grant rehearsal; independent recovery readback after immediate database restart. API types and scoped lint pass. Earlier broader offline API and Web tests and a hosted fixed-fixture genuine Privy check remain separate evidence. Local auth/models/discovery/workflow hosting are adapted, not live provider or hosted durability tests.

Refs xdjs/MusicNerdWeb#1655. Link the paired Web PR and separately prepared endpoint documentation change. Keep the PR draft until target migration reconciliation, legacy activation, raw-reader cutover and compatible rollback are reviewed. Do not auto-close the issue before release acceptance.

Main was rechecked read-only on 2026-11-05 and remains 4f7c2705bde7545c53270fbd732d804aa5d7ca77. Tested candidate: 6a538a05ca94713b201c2718b47390716336a4cd. See 1655-final-compatibility-review-2026-11-05.md for exact scope, deployment sequence and remaining blockers; 1655-full-next-acceptance-2026-11-05.md for validation. No release or publication performed.

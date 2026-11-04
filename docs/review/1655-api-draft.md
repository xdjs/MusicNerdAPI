# Draft API PR — local review text, not published

Title: Prepare eligible Lore before regenerating About

An artist with readable eligible Lore but no generated document currently receives LORE_REQUIRED. The candidate prepares that prerequisite in the existing Lore job slot, then generates and saves About. It reuses a current document, refreshes stale eligible evidence, and checks authority, source revisions and lease ownership before publication. Failures preserve the previous biography and distinguish prerequisite preparation from About generation.

The coordinated candidate also writes private evidence/history and URL receipts atomically. This requires the matching Web schema/public-reader changes and the agreed source-publication policy. Contributor trust does not grant About editing or regeneration authority.

Validation: provider-free tests, native PostgreSQL 17 transactions/concurrency, and a hosted Linux fixed-fixture preview with real Privy login for both approved identities. The ordinary-user fixture was denied before a synthetic claim and succeeded afterward. Hosted missing/current Lore and readback passed. These results do not prove live Supabase permissions, durable hosted storage, full onboarding, or real model latency/quality.

Review boundary: do not publish the entire accumulated integration branch as a small endpoint patch. Reconcile current main and identify the trusted-source/evidence prerequisites explicitly; keep unrelated revocation cleanup and test-deployment tooling out of the application PR unless a direct dependency is demonstrated. Link the Web draft and required API endpoint-docs change required by repository guidance. Use "Refs xdjs/MusicNerdWeb#1655", not an automatic close before release acceptance.

Release remains blocked on the catalog/client migration and the durable integrated rehearsal described in docs/about-1655-acceptance-after-hosted.md. No production release is claimed.

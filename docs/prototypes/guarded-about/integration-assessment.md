# Integration decision for issue1655

2026-11-04 writer-integration update: [actual API/Web receipt integration and current verification](../../about-source-receipt-integration.md) supersedes earlier statements below that receipts use only a test decorator or are not integrated. Migration0062 and real publication/history writers are now implemented locally. Historical backfill, unknown-client cutover and native17/deployed verification remain outstanding.

Local assessment, 2026-11-03. API input664aaa4; Web5ec2be6. Worktrees were clean. The reviewed SQL projection/receipt prototype should **not become an active application dependency in the current candidate yet**. This is a scope and compatibility decision, not an inability to put the receipt call in a transaction.

## Why the full integration is not defensible yet

The existing API/Web public readers already use the JavaScript evidence projector. Current About/history/private-provenance writes are transactional under the artist lock. URL receipts are needed by the proposed SQL public interface, not those existing application readers. Adding mandatory receipt writes alone would add a new migration, failure mode and rollout dependency to regeneration, corrections, manual edits and pins without protecting an additional active reader.

The SQL cutover explicitly revokes anonymous/authenticated raw table access and aborts on unknown raw readers. Confirmed readonly_user/webmapdata_editor access cannot both be preserved and counted as closed. Silently weakening this check to ship the projection would leave the bypass; silently revoking those roles risks unidentified clients and map-editing functionality. The user specifically requires preserving unknown-role access until that decision.

The prototype also defines only id/name/bio, not the full client relation contract. Native17 concurrency, real PostgREST/GraphQL discovery and deployed client queries remain unverified. A production migration cannot treat this fixture shape as a backward-compatible replacement for the full artists table. Full reader/writer switching still needs the documented quiescence and compatible rollback plan.

Independent review agrees with keeping this boundary. No active writer, schema, public reader, grant or migration journal is changed by this investigation.

## Narrow local integration proof

A test-only adapter around the real API persistArtistBio writer is the appropriate next proof. It prepares URL receipts through the same transaction before invoking the actual private-provenance writer. The actual publication transaction continues to save About, Lore, history, private lineage and settlement together. SQL parameters must remain bound; the adapter is never reachable from a request.

This validates the proposed integration seam without creating an unused production dependency. Receipt storage failure/conflict must roll back every affected artifact and lease settlement. URL-policy rejection is different: an authorized manual edit must keep its existing storage behavior; omit the receipt and let public readers hide the text instead of introducing a new editor error. Source withdrawal must still hide generated public output. Auth, provider generation, Web pin/correction paths, genuine concurrent sessions and the real platform remain separate tests; do not label a fixture adapter as released end-to-end functionality. Existing prototype role tests already demonstrate that unknown direct access causes cutover rejection rather than silent grant changes.

## Smallest path to staging

1. Review the original #1655 flow separately from the new database public-interface scope. The existing About/Lore fix and private lineage candidate can be exercised in an explicitly authorized isolated synthetic environment without receipt writes or changing unknown roles. This is not a production privacy-release approval.
2. Resolve who owns readonly_user/webmapdata_editor and the actual interface their consumers need. Preserve their current access in the meantime; use no sensitive fixtures accessible through that unresolved path. Decide the complete projected relation/API contract and approved target-specific grants.
3. In a separate reviewed integration change, add the private receipt schema and atomic writer calls across API current/history/corrections and Web edits/pins. Plan safe receipt preparation for current evidence, not invented legacy lineage. Pin exact validator/runtime policy version. No receipt creation during public reads.
4. Use an already available, approved disposable native17 runtime (or an operator- provisioned isolated environment) for schema/role/transaction/concurrency tests. No install/pull/live write is performed here. Exercise actual handlers, approved direct clients, API discovery and the full row shape before any grant cutover.
5. Rehearse the gated coordinated cutover and fail-closed rollback. A dual-access window remains exposed. Restrict raw paths only after explicit role decisions; keep evidence/raw editor content, and never roll back to raw public visibility.

See staging-plan.md for environment options, attribution evidence and precise release records. No publication, deployment, live database changes or installs.

## Completed verification

Added atomicWriter.test.ts only, with a test-only decorator around the real writer. The final prototype run passed **27 tests in 8.04 seconds**; TypeScript and focused lint passed. Successful publication settles the actual lease; injected receipt storage/conflict errors retain the prior running lease and roll back About/Lore/history/current evidence/activity writes. Manual edits with historical policy-rejected URLs still save, with no receipt and no public disclosure. Refused cutover rolls back without revoking the unknown role. No production files, grants or migration journal were modified.

# Exact legacy biography snapshots — current #1655 policy

Current execution update (2026-11-04): [native PostgreSQL17.11 verification passed](about-pg17-verification.md); use [the current staging/cutover plan](about-staging-cutover-current.md) for current artifact hashes and remaining steps. Earlier unavailable-engine statements below are historical.

User decision, 2026-11-04: leave the existing 16 claimed biographies visible as they are. This supersedes the earlier proposal to hide all unknown legacy biographies. The local implementation preserves only exact reviewed snapshots; it does not restore a blanket exception for every claimed artist.

## Publication permission, not evidence

Migration0063 creates private `legacy_bio_publications` records keyed by artist, bound to the exact approved claim and exact UTF-8 biography hash. The application role can SELECT but cannot insert, alter or delete these permissions. They are separate from source provenance, source approval and URL receipts.

An exception applies only if the current biography matches the snapshot, the same claim is approved, and the current provenance ROW is absent. A malformed, unknown, JSON-null or generated provenance row cannot fall back to an exception. New/generated content remains subject to source receipts, current eligibility/revisions and ownership checks, even if its words happen to equal the old biography. Unclaimed artists, later claims and future text changes do not inherit permission.

The private activation manifest was captured read-only and kept outside Git. It contains 16 artist/claim IDs, biography hashes, the pin checkpoint and source-state checkpoint hashes, not biography/source text. Source checkpoints only detect a stale activation decision; they are not evidence that any source produced the old biography. No permission rows have been seeded and no live records have changed.

## Withdrawal and corrections

Database triggers remove the exception in the SAME transaction when:

- The biography changes, including a changed text later restored by pinning.
- The original claim is revoked, deleted or changes ownership/artist identity. Reapproval cannot restore the deleted permission.
- A previously approved non-private source is deleted, rejected or made private. This is a conservative withdrawal rule, not an assertion that the biography used that source. Rejecting a new pending submission does not withdraw an old exception.
- Current provenance is inserted, changed or deleted. This prevents same-text generation followed by lineage deletion from reviving the legacy exception.

Failed transactions restore both the prior text/state and permission. Ordinary application actions cannot recreate a consumed exception. A privileged operator must not replay an old seed after consumption; any new exception would need a new explicit review/authorization.

Editing an approved source's URL/content without withdrawal does not itself consume the exception. Unknown historical lineage cannot reliably associate particular sentences with particular sources. Legacy prose may therefore contain unsupported, private or inaccurate claims; leaving it public is the user's explicit compatibility decision, not a finding that it is safe or verified. Review and correction remain available. A normal biography edit consumes the old exception and does not fabricate new authorship; a replacement must use the normal supported publication flow. Authorized editors/history retain saved text even when public visibility is subsequently withdrawn.

## Actual setup behavior and local fixes

Claim approval attempts discovery/interview queues and starts the API build. An authenticated approved claimant visiting an unfinished setup starts/resumes the build once authentication is ready; a completed profile, public visit or failed onboarding-state read does not implicitly run new research. Start/enqueue failures remain visible/retryable rather than being treated as success.

The audit found two defects relevant to preserving these artists:

1. `autoBuildAbout` formerly overwrote a pre-existing unmodified biography; expectedBio protected only edits during generation. Pins instead caused publication to fail and leave setup incomplete.
2. `autoBuildSources` formerly auto-approved every pending row, including earlier contributor submissions.

The local correction preserves existing About/pins and prepares material for editing instead. Automatic source approval is limited to newly inserted, readable research returned by the current search, with artist/claim scope and locked status/origin/activity/revision checks. Concurrent rejection, private changes and edits are not overwritten; existing pending and trusted user contributions are not reclassified. Duplicate search results do not replace existing vault rows. Partial failed searches can leave research pending; retries must not broaden approval merely to clear that backlog.

Existing nonempty compiled Lore must also be retained because it has no reliable authored/manual flag. A snapshot check protects concurrent document edits on every publication path. Missing Lore can be synthesized; an empty About may be generated only from eligible current material. When filling an empty About, if retained Lore cannot support safe publication, setup requests explicit review/refresh rather than overwriting it or pretending completion. When both About and nonempty Lore already exist, setup retains both and can complete without generating new text or certifying the old material. Durable correction records remain inputs to synthesis. See the final tests/verification report for the implemented branch details.

## Mandatory activation sequencing

The new application cannot be released with an empty exception table while claiming to honor the 16-snapshot decision. Prepare one separately approved activation transaction while affected writes are drained:

1. Verify reviewed migration0063, strict private grants/triggers, and the private manifest's count, uniqueness and checksum.
2. Lock artists in deterministic order, recheck the exact approved claim, text hash, pin and source-state checkpoints and absence of provenance. Any changed row stops activation for review; do not substitute newly claimed artists or update hashes automatically.
3. Seed ONLY the explicit manifest under the trusted migration/administrative role. Do not use a blanket SELECT of all claimed biographies. Record the exact one-time activation in the release audit so it cannot be casually replayed.
4. Verify all unchanged approved snapshots through the real guarded readers before opening the coordinated application/client cutover. Preserve the existing unknown-raw-reader refusal and target-specific grants. If seeding or a check fails, roll back and do not open the new visibility path.

No activation SQL was executed here. Production grants, model generation, paid research and deployment remain separately authorized actions. Existing client identification, nativePG17 and deployed cache behavior are not proven by this local change.

## Local verification and release handoff

The Web candidate is committed locally as `d219118f1e3b9a0fa5c3807a8bf3ea4414fad99f`. Its full suite passed 434 suites / 3,766 tests (6 skipped), TypeScript and lint passed (existing warnings), and the production build passed with documented dummy values and a network-denial preload. Database-dependent sitemap fallbacks during that build do not verify live integrations.

The marked synthetic PostgreSQL 14.18 instance passed all 24 native integration/concurrency tests and was stopped afterward. These include exact snapshot preservation, permission withdrawal and rollback, setup document compare-and-swap, and research approval racing with moderation or extracted-text changes. This is not PostgreSQL 17 evidence. The disabled official-image CI proposal remains a reviewable path to that check; no workflow was published or dispatched.

Release order remains: identify affected raw database clients and satisfy the compatibility preflight; run the native suite on PostgreSQL 17; validate the coordinated API/Web candidate and migration in isolated staging; review and authorize the private exact-snapshot activation; then deploy coordinated readers/writers and verify public and claimant behavior. Preserve the original raw text and private history throughout. A rollback must not restore unrestricted raw biography access or recreate consumed exceptions. No issue closure or production-success claim is supported by local checks alone.

Final API validation passed 966 suites / 4,902 tests (33 skipped), TypeScript, full lint and full formatting checks. The standard Turbopack build was blocked by the existing external `node_modules` symlink in this isolated worktree. The Webpack production build passed with the environment cleared and HTTP/fetch/net/TLS connections denied; it is compilation evidence, not deployed integration evidence. Independent exact-code review cleared the setup snapshot, manifest validation, no-evidence failure, current-run source approval and exception-consumption changes. Earlier runs during fixture updates failed parity mocks and were superseded by this final stable run.

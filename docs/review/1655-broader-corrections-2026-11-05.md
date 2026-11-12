# Broader protection candidate correction — 2026-11-05

Compared the narrowed candidate 15b7118f with the broader API checkpoint 002ffd59 before porting. Administrator FOR SHARE locking and legacy GET handler-entry deadline/request cancellation were already present in the broader candidate. Contrary to the earlier extraction handoff, its GET implementation did not require a code correction. Added the stronger exact request-signal/deadline regression without changing the protected getPublicSavedBio read path.

The only runtime change is in runLoreRefresh: a changed-evidence result now throws into the existing bounded failure/retry path before settlement. Previously it could report rebuilt after persistence had refused changed evidence. Its regression failed before this line and passed afterward. Generic worker failure settlement retains its existing job-ID-only semantics; this patch does not claim to implement exact-lease recovery for all workers.

## Verification

Offline focused research, bio, ownership and Lore suites: 124 passed; 613 tests passed. The native PostgreSQL suite's 30 tests were intentionally skipped because its isolated runner was not enabled in this focused invocation. They were not relabeled as rerun evidence. TypeScript and scoped ESLint/Prettier checks passed. Log: /tmp/mn-1655-broad-corrections-final.log. No new provider calls, database migrations or hosted changes.

Only one runtime line and two focused regression additions changed. Private provenance, receipt writers/readers, source eligibility, pin/history behavior, migration files and legacy allowances are preserved. Paired broader Web remains 313a9069dd20a4bcda76448fd16b9d591176a56b, clean and unchanged. Smaller extraction branches are not rollback targets for the broader protection candidate.

## Migration and rollback recheck

No migration change is introduced by this correction. The broader rollout still requires target-specific reconciliation of 0060 publication (recorded Dev drift), then 0061 private evidence structures/grants, 0062 URL receipts, and 0063 legacy allowance structures/triggers. Migration 0063 seeds no rows: validate and activate the exact approved 16 current artist/claim/text snapshots before fail-closed readers receive traffic. Do not fabricate provenance or grant new blanket legacy trust.

Gate/drain incompatible readers, writers and jobs during coordinated application/schema activation. The raw-reader projection/client/grant cutover remains separately unapproved, and unknown consumers remain unresolved. Additive tables do not make mixed old/new deployments safe.

Operational rollback must use a compatible guarded API/Web pair and retain evidence, URL receipts, consumed legacy-allowance state and approved raw-read restrictions. Do not drop private tables, restore old raw grants or roll back to main/the narrow orchestration branch as a shortcut. If no compatible operational rollback is ready, retain the gate rather than reopening unguarded reads. These are the existing release decisions, not new requirements introduced by the one-line worker fix.

No publication, merge or deployment was performed. No additional product decision is needed for this correction; shared deployment still needs the target/client cutover and compatible rollback plan described in the final compatibility review.

# About/Lore coordinated release candidate

Local review draft, 2026-11-03. Nothing in this plan authorizes a deployment,
migration, staging mutation, provider call or publication. Issue: xdjs/MusicNerdWeb#1655.

## Candidate and PR scope

API candidate: `761cb8b2cfc250472283a2c129077bf5252da299`.
Web candidate: `9247e10b4c69414462ad391e4caea52e3318443c`.
Both are isolated `codex/about-trusted-integration` worktrees. The API aggregate
against the original base contains 158 changed files; do not describe this as a
small standalone About endpoint patch or include unrelated chat work.

Review as a coordinated dependency stack, reconciling current main before publication:

| Scope | API | Web | Release dependency |
| --- | --- | --- | --- |
| Trusted Lore prerequisite | Source eligibility, upload receipt/fencing | Publication policy, trusted submission identity, migration 0060 | Exact submission-time trust; no contributor profile/regeneration authority |
| Claim revocation prerequisite | Upload races and immutable object identity | Preserve eligible trusted UGC; conservative cleanup | Separate review scope; no blanket folder purge; physical cleanup remains deferred |
| #1655 orchestration | Prepare missing/stale Lore before About; lease/deadline/source checks | Existing regeneration response handling and documentation | No broad research or extraction caused by this action |
| Durable evidence | Current/history persistence and all public API readers | Migration 0061, pins, edits, public content/metadata/share readers | Coordinated pair, protected evidence storage, compatible rollback |
| Verification | Provider-free tests and native PostgreSQL harness | Reader/history/migration regressions | Does not prove deployed end-to-end behavior |

Suggested API PR title: `fix: prepare eligible Lore before About regeneration`.
Body: Regeneration currently fails for artists with usable Lore but no generated
document. Prepare that prerequisite automatically, revalidate source revisions and
authority before saving, and preserve existing content on failure. The linked Web
change supplies the schema and public/history protections; trusted Lore and
revocation prerequisites must be reviewed separately or explicitly included in the
dependency stack. Local only, not released or live-verified.

Suggested Web PR title: `fix: preserve About evidence across history and public reads`.
Body: Save evidence lineage with current and historical About text so withdrawn,
private or rejected sources cannot remain publicly visible through cached text or
pinned history. Preserve legacy claimed-only behavior without inventing evidence.
Requires the matching API writer and an approved database access solution before
deployment. Migration 0061 is not ready to apply unchanged to every target.

The API guide requires an endpoint documentation change in the separate docs
codebase before API/client PRs. That external docs PR has not been prepared or
published here; include error, prerequisite, timeout and partial-completion behavior.

## Read-only catalog evidence

Connected XDJS catalog inspection succeeded for projects named Music Nerd and
Music Nerd Dev. These names alone do not establish the deployed environment binding.
No application records were read. Queries executed as owner `postgres`; grants and
policies were inspected, but this is not an actual application-role execution test.
Both report PostgreSQL 17.6. Local native tests used PostgreSQL 14.18.

| Check | Music Nerd | Music Nerd Dev |
| --- | --- | --- |
| `artist_vault_sources.publication` | Missing | NOT NULL text, default inherit; check allows inherit/public/private |
| Both `bio_provenance` columns | Missing | Missing |
| Relevant tables RLS | Enabled | Enabled |
| `mnweb` superuser/BYPASSRLS | Both false | Both false |
| `mnweb` relevant table access | CRUD except activity events SELECT/INSERT only | Same |
| Artist SELECT policies | mnweb and webmapdata_editor | mnweb and PUBLIC using true |
| anon/authenticated table SELECT grants | Present on artists/history/sources | Present on artists/history/sources |

The inspected history/source policies allow mnweb, not anonymous users. Table
grants alone do not bypass RLS. However, Dev combines public artist-row policy with
table-wide SELECT grants: adding `artists.bio_provenance` makes that evidence
selectable by anonymous/authenticated DB roles. Application response stripping does
not close this path. If Data API exposes this table, it is a direct metadata leak.
Even raw `bio` can bypass the new public projection through that path. Production's
webmapdata_editor has broad artist SELECT; its intended need for new evidence is
unverified. Role memberships, views/RPCs, external clients and Data API exposure
need an explicit audit before treating either target as fully protected.

Release blocker: protect evidence and the public bio projection at every supported
database access path. Evaluate a private evidence relation plus safe public view,
or tightly scoped grants/policies and caller migration. Do not blindly revoke public
artist access, infer unused clients, or apply a broad policy fix in production.
Keep newly recorded manifests private in either design. This document changes no DDL.

Dev already structurally matches 0060; blindly replaying ADD COLUMN will fail.
Verify migration ledger/hash and reconcile drift without forging migration history.
Music Nerd requires 0060 plus 0061; Dev requires verified 0060 reconciliation plus
0061. Recheck immediately before any authorized migration; catalogs can change.

## Coordinated rollout gates and sequence

1. Resolve the database access blocker, review exact API/Web diff against current
   main, and verify environment-to-database/auth/storage/API bindings privately.
   Record pass/fail, not connection strings or project refs. API deployment ownership
   and promotion controls remain unverified; its inspected CI runs checks/builds,
   not a coordinated promotion. Web uses docs/releases.md and protected approval.
2. Establish and test a reversible traffic and worker quiescence procedure covering
   public API/MCP/Web/direct data access, mutations, cron, queued workers, old
   deployment URLs and in-flight requests. No such complete maintenance gate was
   established by this inspection. This is a blocking prerequisite, not an assumed
   environment flag. Drain old jobs/requests before introducing new lineage writes.
3. On an explicitly authorized isolated staging target, take a recoverable backup
   and schema/ledger snapshot; apply reviewed additive migrations atomically with
   bounded lock/statement timeouts. Verify columns, constraints, grants and real
   mnweb access. No backfill or destructive rollback. Keep traffic gated on failure.
4. Build the exact compatible API and Web SHAs for staging, validate immutable URLs
   under restricted access, then switch both while traffic/workers remain gated.
   Complete the staging matrix below before reopening. Record exact deployment IDs,
   SHAs, alias bindings, database revision and evidence of old-worker drain.
5. Obtain separate release approval. Repeat schema/access/drain checks for production.
   Follow Web main-only workflow and protected production approval: build a separate
   production-configured artifact, never promote a staging build. API promotion must
   use its verified operator procedure. Keep the gate until both versions and all
   public entry points pass read-only checks; resume workers only on compatible code.
6. Observe scoped errors, timeouts, lease settlement and public withholding without
   logging source bodies or manifests. Do not claim production generation verified
   from health checks; a synthetic generation smoke requires separate authorization.

An additive schema does not make mixed application versions safe. Old readers ignore
lineage; old writers can create null history. Sequential live promotions without
quiescence are therefore not an acceptable rollout for these protections.

## Rollback

Before reopening, select a known compatible API/Web pair and rehearse rollback in
isolated staging. On failure, gate traffic and workers, drain in-flight activity,
retain both additive columns and recorded lineage, and restore only a compatible
production-built pair. Validate aliases, public readers, auth and worker versions
before reopening. Prefer a forward repair when no previous pair enforces lineage.
Do not fall back to old readers while serving provenance-bearing data, clear
provenance, drop columns, or replay a backup over subsequent user changes. A normal
Vercel alias rollback alone does not roll back database or worker behavior safely.

## Staging end-to-end matrix (planned, not run)

Requires explicit authorization for isolated staging writes and test identities.
Use synthetic records and provider stubs only; if deployed stubs are unavailable,
stop the generation steps until an approved provider test/budget exists. Never
silently replace the actual entry-point test with unit mocks.

| Fixture/action through actual entry point | Required evidence |
| --- | --- |
| Newly added artist, approved eligible Lore, no document; claimant regenerates | Lore then About, one lease, useful success, durable lineage/history, no research/extraction |
| Existing current document; then add eligible Lore and regenerate | Reuse current doc; refresh stale doc; include complete eligible source revisions |
| No usable Lore, private/pending/rejected only | Useful prerequisite error; old About and pin unchanged |
| Inject Lore failure, then About failure after successful Lore | Distinct errors; no false full success; previous About retained; lease settled/recoverable |
| Two clicks, in-flight research, expired/stolen lease | One winner; stable conflict/retry behavior; no stale writer or duplicate generation |
| Revoke claim/admin authority or alter source/trust event during generation | Write fails or serializes safely; no stale evidence publication or new privileges |
| Private/reject/edit/delete source after generation and after pin | All public content/metadata/MCP/llms/share paths withhold invalid output; editor retains history |
| Reuse cached directory/onboarding draft after source changes | Revision validation blocks stale publication; preserve existing trusted UGC through claiming |
| Trusted contributor to unclaimed artist, later whitelist removal | Submission-time trust preserved where policy allows; no profile edit/regeneration permission |
| Anonymous, unrelated user, contributor, claimant and admin | Real auth isolation; no reliance on dev admin fallback; manifests absent from public responses |
| Direct Data API/view/RPC reads as anon/authenticated | No evidence leakage or raw About bypass; include newly added columns and history |
| Legacy/null, malformed/unknown, generated unclaimed, authored claimed history | Preserve documented legacy behavior; fail closed for unknown; pins retain exact lineage |
| Deadline, DB lock timeout, settlement failure and retry | Useful failure, no partial About overwrite, bounded request, recoverable lease |
| Gated upgrade and rollback drill | No old writer/reader reachable during switch; correct environment and compatible pair |

Record only synthetic fixture IDs and sanitized assertions. Clean up only explicitly
created fixtures/objects after checking ownership; never purge artist folders or
reset shared data. Verify cleanup independently, and retain failed-fixture IDs for
an authorized operator if cleanup cannot be proved safe.

## Verification status and next step

Prior local API suite: 4,754 passed, 9 skipped; final related suite: 255 passed.
Web: 430 suites, 3,729 passed, 6 skipped (worker teardown warning). Types, lint and
offline builds passed as recorded in the existing handoff. Native multi-connection
PostgreSQL: 15 passed, including lease races, source/event/role locks and atomic
migration rollback; local cluster stopped. Synthetic policies do not prove target
access or PostgreSQL 17 behavior. No suites were rerun for this documentation-only turn.

Next: review the confirmed direct-read exposure and choose the narrow compatible
schema/access repair, verify deployment bindings and a complete quiescence mechanism,
then rerun native tests with target-equivalent policy/grants and PostgreSQL 17.
Only after those gates should the coordinated PR stack and authorized staging run
be considered release-ready. Read-only catalog access was available; there was no
access denial. Environment mapping, direct-client inventory and API deployment
mechanics remain unverified, not permission refusals.

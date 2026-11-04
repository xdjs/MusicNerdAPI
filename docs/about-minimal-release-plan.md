# #1655 — least-disruptive release preparation

Latest acceptance and remaining execution scope: [post-hosted #1655 review](about-1655-acceptance-after-hosted.md). Real staging login is verified; the separate onboarding visibility follow-up is local only. Use that report for the current Web commit and remaining durable-storage/client gates.

Current execution update (2026-11-04): [native PostgreSQL17.11 verification passed](about-pg17-verification.md); use [the current staging/cutover plan](about-staging-cutover-current.md) for current artifact hashes and remaining steps. Earlier unavailable-engine statements below are historical.

Superseding user decision (2026-11-04): [preserve the exact 16 legacy snapshots](about-legacy-snapshot-exceptions.md) through explicit private snapshot permissions, not a blanket claimed-bio fallback. Earlier statements requiring approval to hide all 16 are historical and no longer the plan. New or changed content remains guarded.

Prepared 2026-11-04; nothing in this plan authorizes publication, CI dispatch, live review writes, model calls, migration, deployment or grants. Current reviewed candidates: API `37ace7e191c2336bdaae71ba98fbcfea0f023aa1`; Web `50a60897aa4f4d48292251859c3125c4c8420fcf`. Later preparation-only commits must be recorded separately.

## Recommended sequence

1. Complete the secrets-free PG17 check using the dedicated manual CI proposal, after its publication/run is separately authorized. Do not dispatch the existing eval or release/smoke workflows: those are different tasks and may use live providers or deployments. Record the resolved image/version, commit, migration hashes and results. The existing hosted API CI file was read through GitHub and has ordinary unit/build jobs only; native tests currently skip without the explicit socket.
2. Pete's legacy decision is now resolved by the exact 16-snapshot exception described in [the current policy](about-legacy-snapshot-exceptions.md). Prepare its guarded activation, and resolve the actual database clients' narrow contracts. Do not extend the exception to future text or claims, guess role ownership, or weaken the cutover guard.
3. After separate approval, perform one isolated staging rehearsal with synthetic records, then the reviewable paired migration/application/client cutover. Keep original artist rows, IDs, writer mappings and FKs. Apply reviewed migrations 0060/0061/0062 only after inspecting the target ledger and exact structure; Dev and production differ. Existing grant/row-visibility checks are target-specific. No broad source refresh or complete research run is required.
4. During an approved cutover window, gate public paths/old workers, drain writes and record backup/artifact versions. Install the reviewed reader and receipt-aware writer pair, switch explicitly approved direct readers to the full-shape guarded relation and restrict their raw biography access within the same transactional cutover. Preserve production map edits and Dev's current no-op updates. Unknown raw readers, unexpected memberships, schema drift or client response mismatches abort before reopening.
5. Verify role sessions, actual HTTP/UI/public metadata/cache behavior and source withdrawal with the gate closed. Reopen only after owner sign-off. Do not count an unexecuted plan or a local test as deployed success; issue closure follows the repository's normal release/sign-off process.

## Prepared review/regeneration worksheet — no execution

The aggregate impact was reported privately in the task conversation. Do not copy biography text, artist IDs, tokens or target references into this public repository. At the approved execution step, build a private manifest from the authorized editor interface with these fields:

| Field | Purpose |
| --- | --- |
| Artist ID and current claim ID | Scope authorization; recheck immediately before any action. |
| Current text hash, pinned-version ID/hash, history count | Detect concurrent edits and prove preservation. |
| Current eligible-source revision manifest and Lore freshness | Establish what a NEW generation may use; never infer old evidence. |
| Reviewer and disposition | Retain privately, queue regeneration, or request a separately reviewed legacy-publication mechanism. |
| Expected preconditions, permitted action, result/error | Prevent stale approval, duplicate regeneration and false partial success. |
| Approved model request/token budget, if any | Required before a real regeneration; zero calls are authorized here. |

Apply these preparation rules:

- Existing text/history remains saved. No bulk deletion, blanket backfill, or automatic authored label.
- Readable current sources can support a new generation, but do not prove historical provenance. Check actual source eligibility/URL safety at execution; aggregate counts are not per-artist clearance.
- Missing usable sources: leave the old text available only to authorized editors and request approved readable Lore. Do not research arbitrary websites to fill the gap.
- A pin is an explicit preservation choice. Leave it untouched unless its owner authorizes unpinning/replacement. The existing regenerate action intentionally does not override it.
- A normal edit of unknown legacy text remains unknown; saving or pinning is not a public-review attestation. This candidate does not implement a new human-review publication action. If exact legacy text must remain public, that workflow must be reviewed explicitly rather than faking sources or authorship in SQL.
- When regeneration is separately authorized, use the normal #1655 action once, preserve its lease/idempotency checks, and record a preparation failure separately from an About failure. Successfully prepared Lore may remain after About failure. Stop on stale claim/source/text, deadline or storage errors; do not replay automatically under an old approval.

This review is intentionally read/decision preparation only. No actual per-record manifest, review verdict, source update, unpin, generation or backfill was executed in this phase.

## Compatibility audit and rollback

The guarded relation preserves the pinned 65 column names/types/order; it changes qualified relation/schema, not automatically OIDs, composite types, FKs/PK discovery, PostgREST embeddings or GraphQL. All non-bio fields remain verbatim, including notes/wallets/added_by/inprocess, so only already approved full-row audiences may use it. Known Web/API public paths use guarded projection and retain their response shapes/fallbacks. Authorized editors retain raw text; published-About correction reports cannot open newly hidden legacy content.

Map client acceptance must explicitly cover UPDATE webmapdata WHERE id and optional RETURNING id,webmapdata. RETURNING * or direct bio SELECT is intentionally not supported after raw denial. Production anon/authenticated must not gain row visibility through an owner-rights view. Dev no-op map updates must not be turned into new authority as an incidental fix. Neither custom role's actual application/operator has yet been established.

Before commit, a refused transactional cutover leaves prior access unchanged: that is a compatibility-preserving refusal, not privacy remediation. After commit, never restore raw SELECT or old unguarded readers as rollback. Keep raw denial and the guarded interface; gate affected traffic, restore only a verified compatible application pair or roll forward. The tested emergency null-About function retains row shape and map behavior while withholding biography text. Keep history, receipts and sidecars; do not reverse source moderation merely to make text visible.

The concrete owner-discovery lead remains Carl's schema-import PR#932/merge#939. Ask who issued and operates webmapdata_editor and Dev readonly_user, and obtain nonsecret application labels and query/write contracts. Carl is a routing lead, not a proven credential owner. No one has been contacted. Missing connection logs are not inactivity evidence.

## PG17 option and current limits

No already-running authorized PG17 environment was established. The Mac's inspected PostgreSQL install is 14.18 and Docker is unavailable. Official hosted runner manifests list PostgreSQL 16 on Ubuntu 24.04 and 18 on Ubuntu 26.04; selecting ubuntu-latest would not prove PG17. See [Ubuntu24 runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) and [Ubuntu26 runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2604-Readme.md), checked 2026-11-04.

The prepared alternative uses an explicitly version-checked official PG17 image with a new private Unix-socket cluster, no TCP, application secrets, service connections or paid models. It is an inactive documentation artifact, not an installed workflow. GitHub supports PostgreSQL-backed container jobs, but that capability is not authorization to publish/dispatch our draft or a guarantee of organization compute entitlement: [official container guide](https://docs.github.com/actions/guides/creating-postgresql-service-containers). Review/pin action/image identities and approve publication plus the specific run before execution; record any compute budget separately.

Portable migration fixtures remove the Mac-specific Web worktree dependency while retaining the destructive-test database identity guards. Local static checks can validate the draft's shape and refusal paths; they cannot substitute for a successful PG17 execution or hosted client verification.

Verification of this preparation: the portable migration fixture harness passed all **19 native PostgreSQL14.18 tests in4.11s** after the path/checksum changes; the temporary server was stopped. Shell/Node/YAML static checks, migration hash checks, types and lint passed. Independent review cleared the disabled CI proposal and release/rollback plan. None of this is PG17 or hosted execution evidence.

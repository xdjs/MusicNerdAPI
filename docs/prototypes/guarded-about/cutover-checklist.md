# Guarded artist compatibility cutover

2026-11-04 writer-integration update: [actual API/Web receipt integration and current verification](../../about-source-receipt-integration.md) supersedes earlier statements below that receipts use only a test decorator or are not integrated. Migration0062 and real publication/history writers are now implemented locally. Historical backfill, unknown-client cutover and native17/deployed verification remain outstanding.

Local candidate and release checklist, 2026-11-04. No deployment, live grant changes or publication is authorized by this document. The full-row builder is a tested design artifact, outside the Drizzle migration journal; it is not yet an active reader/writer dependency.

## Concrete interface decision

Keep the existing artists table, trusted writer mappings, FKs and row-lock protocol. Approved existing direct full-row readers can move their read relation to `mn_public.artists`; explicit pinned columns preserve result names/types/order and replace only bio with the evidence guard. This changes relation/schema selection. It does not preserve relation OIDs, composite types, FK/PK discovery, PostgREST embeddings, GraphQL, or writable SELECT-star/RETURNING-star semantics.

All non-bio columns remain unchanged, including notes, added_by, wallets and inprocess. This is a compatibility interface for explicitly approved pre-existing full-row readers, not an approval to expose those fields to a new audience. The pinned 65-column Web manifest must match target catalog order/types exactly; drift is an error requiring review. Do not auto-append new columns or drop columns to make the check pass.

The map client's supported narrow write contract is UPDATE webmapdata WHERE id, optionally RETURNING id,webmapdata. It keeps column-scoped SELECT(id,webmapdata) and its existing UPDATE(webmapdata) authority/policy. SELECT bio and RETURNING * must fail. Whether the real client uses that supported contract is still unknown; a synthetic example is not consumer migration evidence.

## Target-specific access shape

2026-11-04 read-only catalog inspection independently verified the relevant roles/policies; see ../../about-role-attribution-history.md. Replicas test the observed shape, not a complete hosted environment.

- Dev: PUBLIC SELECT USING(true), anonymous/authenticated and both custom readers have base SELECT. Map UPDATE grant exists but there is no applicable UPDATE policy: preserve its no-op behavior. Do not add a policy to “fix” this as part of About.
- Production: no PUBLIC SELECT policy; anon/authenticated object grants alone do not expose rows. Do not grant them the owner-rights full-row view or its direct projector function. webmapdata_editor has SELECT and UPDATE policies. readonly_user is absent in the inspected named-role result.
- Both: mnweb remains the trusted application writer. It is not a template for classifying unknown consumers as trusted.

The builder's explicit public-reader switch must be selected from independently reviewed row/field visibility, not from has_table_privilege alone. Reject privileged/system role names as migrated clients. Unknown raw readers and assumable membership paths cause transaction refusal; do not expand a trusted-role exclusion just to pass preflight.

## Before an executable release migration exists

1. Identify each effective raw reader and a named accountable consumer owner from existing provisioning metadata or a verified client contract. Do not infer disuse from missing sessions/statements/logs. Record qualified relation names, result fields, write/RETURNING columns, role switching, schema exposure and cache behavior. No consumer has yet been established for either custom role.
2. Review the complete non-bio field/row audience and client migration. Approval must specify the actual role mapping and whether map writes use the narrow contract. A generic request to unblock the issue is not evidence that an unidentified client accepts a breaking relation change.
3. Integrate URL receipts atomically with all actual API/Web About/current/history/pin/correction publication paths, using the existing URL validator and explicit policy version. Existing test-only writer decoration does not perform this integration. Backfill only validation receipts for exact current bytes under separate reviewed scope; never invent historical source lineage. Missing receipts intentionally hide generated content.
4. Generate a separately reviewed migration from the finalized target-specific artifact and pinned schema. Keep the guard/receipt implementation, application readers and writer version paired. The current local builder must not be pasted into production as a shortcut.
5. Run native PostgreSQL17 migration, policy, separate-session race and rollback tests, then real isolated API/Data API/GraphQL/client checks as applicable. PGlite row-shape success is insufficient. No PG17 installation or remote synthetic writes have been performed in this pass.

## Preflight and transactional cutover

Gate public traffic, old deployments and background jobs; drain in-flight generations before the cutover window. Obtain a restorable backup and pin the compatible API/Web/DDL artifacts. Run read-only preflight on the actual target immediately before execution:

- Exact artist column signature, sidecars, receipt schema/version and approved object ownership/default ACLs match the reviewed candidate.
- Enumerate table/column grants, applicable RLS, PUBLIC grants, defaults, role attributes and inherited/SET ROLE reachability. Account explicitly for service identities and privileged RPC/view forwarding, not just LOGIN roles. Abort if any consumer/privileged forwarding path remains unclassified.
- Verify every mapped client against the new relation and narrow writes; confirm field/row audience and API schema metadata. Unknown readers are a hard stop, even if their roles have no recent logs.
- Verify raw editor content, history and source/provenance revisions are preserved; receipts cover intended visible generated biographies. No model/extraction call is necessary.

Only after those gates: run the reviewed migration inside one explicit transaction with bounded lock/statement timeouts. Create the dedicated NOLOGIN/NOBYPASS projection owner and guard, install exact view grants for the target audience, migrate only explicitly approved custom readers, retain the approved map column grants, and remove raw bio access from untrusted effective/assumable roles. Final postflight in that same transaction must refuse unknown raw bio readers, broad map mutation rights, grant inheritance escapes or unexpected public function exposure. On failure roll back the transaction; do not catch the error and continue or retry with broader allowlists. Existing access remains unchanged on a refused cutover; this preserves compatibility but is not a privacy fix.

With traffic still closed, exercise role sessions: allowed full-row view with bio masking/withdrawal, denied raw bio and private evidence, expected map update or no-op per target, no unexpected anon/auth row access, trusted app writes, pins/history, simultaneous source withdrawal and generation. Verify actual hosted API schema discovery and client responses. Reopen only if all checks pass and the owner signs off.

## Rollback that does not reopen the leak

Before transaction commit: abort leaves original grants/objects intact; retain the traffic gate if original exposure is unacceptable. This is deployment refusal, not a successful remediation.

After commit: do not restore raw SELECT grants, replace the guarded view with the original table, or drop provenance/receipts while readers/writers rely on them. Keep raw denial and the safe read interface. Gate traffic and stop new jobs, drain generation, then restore a previously verified compatible application pair or roll forward the guard fix. If no compatible pair exists, remain unavailable for the affected path; fail closed rather than exposing restricted text. Keep artist text/history unchanged for authorized editors. A source moderation change must not be rolled back merely to make a biography visible.

The local emergency fallback test replaces only the guarded biography function with a null-text result, retaining all view columns, raw denial and existing map-write behavior. This deliberately removes public About availability without restoring restricted text; an operational use still requires a reviewed artifact and approval.

A destructive schema-down test belongs only in a fresh disposable replica. Real rollback needs a separately reviewed compatible artifact and operational approval. Historical downstream copies/caches cannot be recalled by a database grant change.

## What this unblocks, and what it does not

The local candidate removes the known three-column shape limitation and demonstrates an enforceable narrow map-write contract and target-specific visibility. It does not identify actual consumers, finish atomic receipt integration, verify native17/API discovery, or authorize a grant cutover. Those are concrete remaining gates, not reasons to repeat the same prototype tests indefinitely.

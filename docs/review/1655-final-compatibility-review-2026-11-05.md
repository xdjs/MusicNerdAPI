# Final local review package and deployment compatibility — 2026-11-05

## Pinned application/test candidates

- API main: 4f7c2705bde7545c53270fbd732d804aa5d7ca77; candidate: 6a538a05ca94713b201c2718b47390716336a4cd.
- Web main: 03b2d9a556644d4ec7121fca398977057ad8c90f; candidate: f58408fae9703f54d7522423f904965b473afe41.

Both upstream main refs were rechecked using read-only `git ls-remote`; unchanged. The later review-doc checkpoint does not change tested application code. Exact full patches and name/status manifests are exported locally under `/tmp/mn1655-final-pr-review-20261105`, with SHA-256 checksums. They are complete review diffs, not deployment scripts or an assertion that the accumulated branch is a small PR.

API diff at the tested candidate: 298 files, +20008/-469. This includes 95 prototype files (+11768), 11 review documents (+382), 78 test files (+4935/-217), and 114 other application/documentation files (+2923/-252). Web: 110 files, +41309/-363, dominated by four generated migration snapshots and a synthetic Web-schema fixture. Trusted uploads/revocation, source-publication policy, private evidence, public readers, onboarding and harnesses are intertwined. Publish as an explicitly described dependency stack or extract and retest; do not silently omit dependencies. Endpoint documentation is a separate local draft.

## Independent compatibility review

The pair is ready for code review, not shared deployment. No new application defect was found in this review; operational compatibility remains unresolved:

1. Migration 0060 unconditionally adds publication, which recorded Dev metadata already contains. Reconcile shape and migration ledger first. Inspect 0061–0063 private schemas, policies, grants and trigger ownership against the chosen target; do not blindly replay migrations or mark drift as applied.
2. Old writers do not maintain complete evidence/receipts; old readers ignore them. Additive tables do not establish safe mixed-version operation. Gate/drain application traffic, old previews and background writers before coordinated activation.
3. Known custom raw readers can bypass application projections. The guarded relation and map-compatible write contract are prototypes, not an approved migration. Unknown consumers and inherited grants must be resolved; absent logs do not establish disuse.
4. Migration 0063 intentionally seeds no legacy allowances. Validate the exact approved 16 artist/claim/text-hash tuples against current state and activate them before the new readers receive traffic. Any mismatch stops activation; never generalize this exception or invent evidence. Source withdrawal, claim change, text change and provenance writes consume allowances transactionally.
5. Alias rollback to old unguarded readers is unsafe. Retain private evidence, receipts, consumed-allowance state and raw-read restrictions. Use a compatible guarded application pair for rollback; otherwise keep the traffic gate closed. The local tests do not establish a complete operational gate/rollback implementation.

## Coordinated release sequence to prepare, not execute

Finalize target-specific raw-reader projection/grants and identify client owners; reconcile target migration drift; pin schema/API/Web/worker artifacts and a compatible rollback pair. Rehearse those exact permissions and clients on the approved synthetic target. Obtain the separately scoped migration/grant approval. Gate and drain old readers/writers/jobs; retain recoverable backups. Install private structures, validate/activate exact legacy allowances and perform the approved client/grant cutover. Start the compatible pair behind the gate. Verify preserved legacy text, source withdrawal, biography/history visibility, select-star shape and map name-based writes before reopening. Do not drop security structures or restore old raw grants during rollback.

## Hosted test executable status

Not executable with the presently verified access path. Read-only inspection confirms Dev PostgreSQL 17.6, postgres CREATEDB/CREATEROLE (not superuser), and no extra logical database. Prior dashboard inspection established the session pooler host/port. Official Supavisor docs support database/user/mode routing. However, alternate-role login to a database that does not yet exist cannot be verified without the approved creation step.

A standalone ordinary PostgreSQL driver/psql connection is the documented technical route and passed the local non-superuser rehearsal. It requires an already authorized operator connection with CREATEDB, CREATEROLE and SET ROLE authority for the new owner. Such a direct operator connection has not been established here. No credentials were searched for, revealed, reset or created.

The installed Management API connector accepts query/project only, not an alternate database or an explicit nontransactional mode. A read-only own-statement diagnostic showed the submitted SELECT plus audit comments and read_only=off; that does not prove there was no preceding BEGIN or guarantee DDL transport behavior. Public postgres-meta code delegates to a node-postgres query and can prepend SET statements for timeouts; the hosted management service and its deployed configuration are not established by that upstream source. Do not turn this into a trial CREATE or a claim that the connector is definitively incapable.

Sources: https://supabase.com/docs/reference/api/v1-run-a-query ; https://supabase.com/docs/guides/database/connecting-to-postgres ; https://supabase.com/kb/troubleshooting/supavisor-faq-YyP5tI ; https://raw.githubusercontent.com/supabase/postgres-meta/master/src/lib/db.ts ; https://www.postgresql.org/docs/17/sql-createdatabase.html .

## Exact hosted permission scope, if a supported operator path is established

The existing proposal requires one TEMPLATE0 database mn_1655_acceptance, one NOLOGIN owner mn_1655_owner, one two-hour restricted LOGIN mn_1655_app (connection limit 2), temporary SET ROLE membership only in that new owner, explicit synthetic-table privileges, two synthetic artists/two account rows/two Lore sources/one claim, and a server-only connection secret scoped to up to three protected existing test previews. Bound to two hours and twenty API calls, no real content/models/shared workers. Bootstrap SQL must first be adapted from hardcoded mnweb grants and reviewed. Close bootstrap sessions, revoke membership and verify fresh runtime denials before testing.

Cleanup includes disabling that exact login, stopping its previews, removing the deployment secret, terminating only matching database-and-role sessions, and dropping the exact new database/roles after identity checks. No existing role membership, pooler setting, shared schema, production grant or subscription change. Shared compute/storage/WAL/auth/preview usage remains nonzero; no guaranteed zero-dollar invoice is claimed. Full details remain in 1655-minimal-hosted-plan-2026-11-05.md.

## Recommendation and alternatives

Proceed with draft code review from the local verified pair while keeping release blocked on compatibility work. Do not make an extra hosted database a prerequisite for reviewing the fix.

If hosted durability is required, the smallest direct option is an existing authorized operator running the reviewed standalone bootstrap over the verified session pooler, then the restricted application test. Establish that operator path without asking anyone to paste a password into chat. No known owner/recipient is fabricated here.

A Supabase project/branch is an alternative with separate cost and credential approval, not the default. A schema inside shared postgres is not equivalent isolation: existing workers and hardcoded schema paths require additional changes. Exposing local PostgreSQL to a preview would add networking/access scope and is not needed for the already-passing local browser/persistence tests. No alternative was executed.

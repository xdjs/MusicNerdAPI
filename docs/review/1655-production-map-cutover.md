# Music Nerd access-only release candidate

Grapevine preservation is stopped. Its client, deployment, cache writes and compatibility view are not release dependencies. This supersedes earlier map-preservation and projection-installation plans. The historical prototype files remain available for reference; the production stage does not invoke them.

## Exact proposed production scope

`productionMapCutover.sql` retains its historical filename but now performs only access revocation and assertions inside an outer transaction. It creates no role, schema, function, view or policy; grants no permissions or memberships; writes no artist or evidence records; and never commits.

- Revoke SELECT on `public.artists` from PUBLIC, anon and authenticated.
- If present, revoke SELECT on that table from `webmapdata_editor`. PostgreSQL also removes the corresponding direct column SELECT grants. Assert that the retired role has no remaining effective column SELECT, including when it is NOLOGIN.
- Preserve existing UPDATE grants, roles, deployments and RLS policies. Writes whose predicates require revoked reads may cease working. No replacement interface is provided for obsolete clients.
- Preserve `mnweb` and verified managed operator authority. Audit all non-system roles, including NOLOGIN groups and reachable SET ROLE paths, for unexpected raw reads. Unknown readers or operator/membership drift abort; do not automatically revoke additional roles or widen the allowlist.
- Existing pg_* built-in roles are platform authorities, not independently retired readers. Non-system roles that can reach their read authority are still audited. Database superusers and the verified managed operators remain trusted.

This is a local proposal, not permission to execute production revocations. Any other consumer sharing the retired role would lose raw artist SELECT access too; do not claim exclusive role ownership. Direct anonymous/authenticated raw artist reads will fail. Intended Music Nerd readers use the existing authenticated database role and application eligibility checks.

## Preserved application and evidence safeguards

The candidate starts from API 2487660fa0f25fe1f926a9cc2a5d759aa6b82773 and pairs with Web da3ba3dc19469d41d1579243b1916755fbec6aa2. Runtime About/Lore orchestration, source eligibility, history, claims, URL receipts and private provenance are unchanged. No Music Nerd runtime code uses the removed projection interface.

Migrations 0060–0064 and fixture checksums are unchanged. Preserve the exact 16 approved legacy snapshots: load the private existing manifest, run `legacy-about-preflight.sql` before 0060 changes source shape, and retain the locks and validated temporary state in the same transaction through `legacy-about-activate.sql`. Do not regenerate historical evidence, seed blanket allowances or resurrect consumed exceptions. Keep the private manifest out of Git. Never replay modified historical migrations into Dev or rewrite its ledger.

## Release and rollback

1. Review the exact API/Web pair and access-only SQL, complete CI and endpoint documentation, and obtain explicit production approval for migration, raw-read revocation and service interruption scope.
2. Gate/drain old API/Web writers and worker endpoints, including GET and POST research advance, immutable deployment URLs and in-flight requests. Stopping cron alone is insufficient. Record the compatible application artifacts and database recovery point; no gate is executed by this script.
3. In one bounded transaction: load/validate the exact-16 manifest; apply reviewed 0060–0064; execute the access-only stage; activate the validated legacy exceptions; verify application/evidence permissions and unchanged legacy text; commit only on success. Drift aborts the transaction.
4. Release the compatible API/Web pair and compatible workers, verify intended public reads, regeneration prerequisites and preserved legacy text, then reopen. No Grapevine deployment or projection-owner step exists.
5. Before commit, ROLLBACK restores the original ACLs and schema transaction. After commit, retain raw-read denial, evidence and consumed legacy state. Gate affected traffic and roll forward or use a compatible reviewed API/Web artifact. Do not restore unsafe binaries or broad raw grants. The historical `rollback-public-bio.sql` operates on an uninstalled prototype and MUST NOT be used for this access-only release. No automatic post-commit downgrade is proposed.

The issue remains open until production verification and Pete's acceptance. No production action is authorized by this document.

## Verification boundaries

Tests cover required outer transaction, nonsuperuser operator execution, no new projection objects, unchanged stored artist/evidence data and app reads, retired/public raw-read denial, preserved write ACLs, unexpected login/NOLOGIN/SET ROLE and column privileges, atomic rollback, absent retired role and unchanged unrelated default grants. Broader application tests retain source-withdrawal, claim, history, exact-16, concurrency and restart coverage. The permission rehearsal is synthetic and does not establish current production grants or hosted runtime behavior. The ACL audit covers raw-table and role-membership paths; it does not establish that every pre-existing view or SECURITY DEFINER function is leak-free. Retain the separately recorded bounded reader audit and stop on newly identified paths.

## Local review result

The new generator regressions failed before implementation and pass after it. Final access-only native PostgreSQL17 rehearsal passed15/15; broader native coverage passed30 cases with2 browser-only skips, plus role isolation and identical independent application readback after immediate restart. Full API validation passed types, lint, formatting, build and5,004 tests (56 skipped), using two test workers without changing timeouts. Independent exact-code review found no blocking defect and confirmed the bounded ACL-audit limitation above. No hosted or production action was performed.

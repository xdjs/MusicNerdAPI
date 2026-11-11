# Current recommendation — reuse existing infrastructure

Supersedes the new-project proposal retained below. Pete explicitly said not to create a new Supabase project. Nothing was provisioned.

## Recommended path

Finish provider-free local PostgreSQL 17 and local Web acceptance first; prepare the linked draft PRs from those results. A hosted database is not a prerequisite for review. For the remaining hosted cross-request persistence check, prefer one short-lived logical database in the existing Music Nerd Dev instance, subject to the narrow permission and connection checks below. Do not create another project or expose the Mac through a new tunnel.

## What is already proven and what remains

- Native PostgreSQL 17.11: 28 tests passed, including actual route calls and a fresh mnweb connection. The runner also verified identical committed About, Lore, history, provenance, receipts, sources and jobs after an immediate stop and WAL recovery restart. See 1655-local-acceptance-2026-11-05.md.
- Hosted fixed-fixture preview: genuine staging Privy tokens reached the actual About API role guard; admin and approved synthetic claimant succeeded, ordinary user received 403. Deterministic generation exercised missing and existing Lore documents. Its database resets per HTTP acceptance request, so it does not establish hosted persistence.
- Web: the latest focused run passed 246 tests across 20 suites, types and an offline production build. Full deployed onboarding remains unverified.
- Existing local native PostgreSQL can exercise restart and full local Web/API persistence. The hosted preview cannot connect to its Unix socket/localhost. No working tunnel exists; adding one is unnecessary access and operational complexity.

## Read-only Dev findings on 2026-11-05

Target is Music Nerd Dev, PostgreSQL 17.6; production was not changed. Only the postgres database currently exists, and the inspecting role has CREATEDB. Official Supavisor documentation explicitly supports distinct database names in pooler connection strings: https://supabase.com/kb/troubleshooting/supavisor-faq-YyP5tI . A second logical database shares the existing instance, compute and cluster roles; it is not a separately billed project. This is not a promise of zero incremental storage/egress costs or zero shared-resource contention.

PUBLIC has CONNECT and TEMPORARY on the existing postgres database and USAGE on its public schema, but no PUBLIC relation grants in public or mn_private were found. No PUBLIC-executable SECURITY DEFINER functions were found in public. Extension schemas contain such functions but were not among the schemas with PUBLIC USAGE. These catalog checks make an unprivileged login plausible, not proven: validate actual role memberships, schema/column/function access and negative reads before deploying it. NOINHERIT does not remove PUBLIC privileges, and the login must not be described as unable to connect to the shared database. Do not revoke existing PUBLIC access to force isolation.

The separate logical database naturally isolates fixture research jobs from shared workers. It tests actual SQL persistence and API authorization, not Supabase Data API/Auth/Storage routing or production-equivalent permissions. Its availability through the existing pooler has not been tested. No new login or database exists yet.

## Exact permission needed for that hosted test

Authorize creation and later removal of one named disposable logical database in Music Nerd Dev and one expiring, non-owner, non-superuser test login with no existing role memberships. Bootstrap only synthetic fixtures and reviewed schema in that database; grant the login only necessary fixture permissions. Store its connection solely in the protected test deployment. Bound application connections and test duration, verify target/database/current_user and denial of shared application reads, and stop before test writes if isolation fails. Do not alter existing grants, pooler settings, aliases, production or shared application rows. Cleanup disables the test login, stops its preview traffic, drops only the recorded disposable database and role, and verifies removal. This creates a credential, so current read-only investigation does not authorize execution.

## Is a minimal shared-staging migration feasible?

Yes, but it is more disruptive than the logical database. Actual read routes need migrations 0061, 0062 and 0063 (including the legacy table even when empty); 0063 attaches triggers to shared artists, claims and vault sources. Dev already has the source publication column, so migration 0060 requires ledger reconciliation rather than blind replay. New private-table grants to mnweb and synthetic artist/claim/source/job writes and cleanup require explicit approval. Do not seed the 16 production legacy snapshots into Dev or change raw-reader grants for this test.

The test must also prove shared workers cannot consume synthetic jobs. The repository claims expired jobs after a three-minute lease and declares a research cron; this is evidence of a possible worker path, not proof that staging cron is active. Establish all active pumps or an approved exclusion/quiescence mechanism first. Otherwise interrupted test jobs could invoke real providers. No such worker change is authorized or made. Existing Dev triggers on the inspected application tables were only updated_at and source-version retention; no direct external-call marker was found, which is not a transitive egress audit.

A shared rehearsal would establish actual Dev permissions and persisted route behavior, but would not establish the final raw-bio privacy cutover while unknown raw readers retain privileges. Production would remain untouched; shared Dev would still incur DDL locks and synthetic writes, so it cannot honestly be advertised as impact-free.

## Decision

Do not buy or create a Supabase project. Continue local acceptance and PR preparation now. If hosted durability is required before PR publication, request only the disposable logical database/test-login scope above, after preparing the exact reviewed setup and cleanup script. Keep final shared-staging migration and raw-reader cutover as separate release steps.

---

## Superseded proposal — historical evidence only

# Single proposed durable target — not created

Recommend one fresh **Micro PostgreSQL17 Supabase project**, `mn-1655-durable-20261105`, in the existing **xDJs Pro organization**, region `us-west-1`. Use only synthetic fixtures; delete immediately after the rehearsal and no later than24 hours after provisioning. Reuse the existing Vercel project and approved staging Privy identities. Do not create a new organization, Vercel project, Privy app, paid networking add-on or production connection.

## Verified account and displayed cost

Read-only account metadata confirms xDJs is Pro; the connected account lists xDJs as its only organization, so no existing Free organization was found in this account. The organization-specific cost tool currently displays:

- New project: `{type: project, recurrence: monthly, amount: 10}` — USD10/month quoted rate.
- New branch: `{type: branch, recurrence: hourly, amount: 0.01344}`.

Official current billing documents state Micro project compute is USD0.01344/hour, with partial hours rounded up; 24 billed hours is **USD0.32256 compute** before credits/taxes/other usage. The displayed USD10/month is an ongoing compute estimate if retained, not a new Pro organization subscription or a one-month minimum purchase. Creating it DOES add metered costs that continue until deletion/pause; there is no automatic hard24-hour spending cap. Usage credits, egress/storage and preview/auth charges prevent an exact all-in invoice promise. No cost-confirmation token was requested or accepted.

A branch is not cheaper at the quoted Micro rate. It creates a separate instance and credentials but copies base-project configuration and deployed Edge Functions; avoiding that inherited behavior is why a fresh project is the minimum safe choice here. Do not use a branch merely because its quote is expressed hourly.

Sources checked2026-11-05: [compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [branch pricing](https://supabase.com/docs/guides/platform/manage-your-usage/branching), [branch contents](https://supabase.com/docs/guides/deployment/branching).

## Existing and local alternatives checked

No existing project was established as disposable. Dev has no branches. Music Nerd's branch listing contains only its default main environment, not a spare test branch. Do not reuse another app or the shared Dev database without an explicit isolation/ownership decision.

The Mac has Docker and ngrok executables and the already verified native PostgreSQL17 runtime. Docker context is local Unix-socket; actual container listing cannot connect to the daemon. `docker info` exits0 but returns no server version and a cannot-connect error, so its exit status is NOT evidence of a usable daemon. No ngrok process is active; the old local test cluster has no postmaster PID file. No existing preview-to-local path was established. Even a running local container would require a newly exposed/tunneled route and continued Mac uptime for the hosted preview. Do not create that access or claim localhost is reachable from Vercel. Local native tests remain useful and free of provider compute, but cannot substitute for this hosted durable integration check.

## Access and credential scope requiring approval

Project provisioning creates a new isolated database endpoint and project-managed API/auth credentials. Those credentials are scoped to this new project; they do not authorize existing Music Nerd data. Keep all values out of chat, source, logs and artifacts. Use the privileged project administration path only for explicit bootstrap/seed/cleanup. Create one separate expiring application login with no superuser/BYPASSRLS/role-management capability and only the reviewed fixture schema permissions; do not deploy the owner password or service-role key into the preview. Any connection string is server-only, deployment-specific, and never NEXT_PUBLIC. Verify the actual role and target before fixture setup.

Use the documented shared pooler over TLS for Vercel; no IPv4 add-on is proposed. Verify custom-role connection and required transaction/session behavior on the new target before tests; do not infer support by composing a hostname or reusing parent-project credentials. [Connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

No production records are copied. Seed exactly the manifested synthetic artist/claim/source cases once through operator setup. Requests never bootstrap or reseed. Model/search/extraction/social-job boundaries remain deterministic and provider-free. Existing shared privileges, security settings and aliases stay unchanged.

## Cleanup and rollback included in proposed authorization

Record the newly returned project ID and test deployment IDs before any mutation. On success, failure or expiry: stop the test traffic, drain its connections, disable the new test login, retain sanitized assertion results, delete only the manifested durable-test deployments and the exact new Supabase project, then verify its absence/inaccessibility. Never delete by a broad name pattern or operate on a parent project. Remove deployment-only secret references; no secret values belong in the retained report.

Project deletion is irreversible and removes that test database, backups, project credentials and configuration; billing stops at deletion, accrued charges remain, and DNS cleanup can lag. This is acceptable only because the target contains disposable fixtures. There is no shared-data migration to roll back; rollback is removing the isolated test resources. If deletion fails, report the exact target and continuing billing immediately rather than claiming cleanup. [Deletion behavior](https://supabase.com/docs/guides/platform/delete-project).

**Approval proposal:** the named project in xDJs at the displayed USD10/month metered rate, for at most24 hours (aboutUSD0.33 compute for24 billed hours, not an all-in cap), its isolated expiring test credential/fixture setup, and exact-resource cleanup. The operator must confirm the account quote and scope before creating anything. No resources, credentials, access rules or tunnels were created during this investigation.

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

Connected projects are Music Nerd, Music Nerd Dev, MNTV, Between Sets and Roomtone; none is designated disposable. Dev has no branches. Music Nerd's branch listing contains only its default main environment, not a spare test branch. Do not reuse another app or the shared Dev database without an explicit isolation/ownership decision.

The Mac has Docker and ngrok executables and the already verified native PostgreSQL17 runtime. Docker context is local Unix-socket; actual container listing cannot connect to the daemon. `docker info` exits0 but returns no server version and a cannot-connect error, so its exit status is NOT evidence of a usable daemon. No ngrok process is active; the old local test cluster has no postmaster PID file. No existing preview-to-local path was established. Even a running local container would require a newly exposed/tunneled route and continued Mac uptime for the hosted preview. Do not create that access or claim localhost is reachable from Vercel. Local native tests remain useful and free of provider compute, but cannot substitute for this hosted durable integration check.

## Access and credential scope requiring approval

Project provisioning creates a new isolated database endpoint and project-managed API/auth credentials. Those credentials are scoped to this new project; they do not authorize existing Music Nerd data. Keep all values out of chat, source, logs and artifacts. Use the privileged project administration path only for explicit bootstrap/seed/cleanup. Create one separate expiring application login with no superuser/BYPASSRLS/role-management capability and only the reviewed fixture schema permissions; do not deploy the owner password or service-role key into the preview. Any connection string is server-only, deployment-specific, and never NEXT_PUBLIC. Verify the actual role and target before fixture setup.

Use the documented shared pooler over TLS for Vercel; no IPv4 add-on is proposed. Verify custom-role connection and required transaction/session behavior on the new target before tests; do not infer support by composing a hostname or reusing parent-project credentials. [Connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

No production records are copied. Seed exactly the manifested synthetic artist/claim/source cases once through operator setup. Requests never bootstrap or reseed. Model/search/extraction/social-job boundaries remain deterministic and provider-free. Existing shared privileges, security settings and aliases stay unchanged.

## Cleanup and rollback included in proposed authorization

Record the newly returned project ID and test deployment IDs before any mutation. On success, failure or expiry: stop the test traffic, drain its connections, disable the new test login, retain sanitized assertion results, delete only the manifested durable-test deployments and the exact new Supabase project, then verify its absence/inaccessibility. Never delete by a broad name pattern or operate on a parent project. Remove deployment-only secret references; no secret values belong in the retained report.

Project deletion is irreversible and removes that test database, backups, project credentials and configuration; billing stops at deletion, accrued charges remain, and DNS cleanup can lag. This is acceptable only because the target contains disposable fixtures. There is no shared-data migration to roll back; rollback is removing the isolated test resources. If deletion fails, report the exact target and continuing billing immediately rather than claiming cleanup. [Deletion behavior](https://supabase.com/docs/guides/platform/delete-project).

**Approval proposal:** the named project in xDJs at the displayed USD10/month metered rate, for at most24 hours (aboutUSD0.33 compute for24 billed hours, not an all-in cap), its isolated expiring test credential/fixture setup, and exact-resource cleanup. The operator must confirm the account quote and scope before creating anything. No resources, credentials, access rules or tunnels were created during this investigation.

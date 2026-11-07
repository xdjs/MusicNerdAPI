# Hosted feasibility follow-up — read-only, 2026-11-05

Do not request execution approval for the hosted proposal yet. Supported routing and local grant semantics are established; the connector's standalone database-creation path remains unverified.

## Verified

- Existing Music Nerd Dev dashboard is accessible and healthy on Micro/PostgreSQL 17. Its Connect panel exposes the shared session pooler in us-west-1 on port 5432 and the current postgres database. It explicitly says the IPv4-proxied session pooler is free. No password was revealed/reset/copied; the URI contained only a password placeholder. Exact target/pooler identifiers stay in the private task conversation, not public repository docs.
- Supavisor documentation supports distinct user/database/mode connection combinations. Bootstrap SET ROLE requires session mode, not transaction-pool reuse assumptions: https://supabase.com/kb/troubleshooting/supavisor-faq-YyP5tI . Actual new-role/new-database routing cannot be authenticated before those resources exist.
- The local PostgreSQL 17.11 bootstrap rehearsal passed using a non-superuser CREATEDB/CREATEROLE operator. It creates an owned disposable database via a standalone driver statement, bootstraps through explicit owner membership, closes bootstrap connections, revokes membership, and proves a fresh app session cannot assume owner, create tables or read a synthetic shared relation. Allowed bio writes/row locks and append-only receipt access succeed. All exact local resources are cleaned up.
- Test script: docs/prototypes/pg17-ci/bootstrap-role-rehearsal.mjs. Evidence: /tmp/mn-1655-bootstrap-check.log, including roleRehearsal=passed; native28 tests and restart check also pass. This is reduced grant coverage, not the entire app's bootstrap/migration contract, hosted authentication or password-expiry testing.

## Unresolved creation path

Official Management API POST /v1/projects/{ref}/database/query documents query, parameters and read_only only—no alternate database or nontransactional option. The public MCP platform code forwards those fields without a client-side BEGIN, but does not establish server transaction behavior. PostgreSQL prohibits CREATE DATABASE inside a transaction. Thus a plain direct Postgres driver is proven locally, but the available hosted connector cannot yet be asserted to support the same operation.

Sources: https://supabase.com/docs/reference/api/v1-run-a-query ; https://github.com/supabase-community/supabase-mcp/blob/main/packages/mcp-server-supabase/src/platform/api-platform.ts ; https://www.postgresql.org/docs/17/sql-createdatabase.html . No hosted trial CREATE, new credential, secret access or password reset was attempted.

CREATE DATABASE OWNER also requires the creator to be able to SET ROLE to the new owner. CREATEDB/CREATEROLE alone are insufficient. The proposal must explicitly include any temporary creator membership, revoke it afterward and verify ownership; the local script tests this. Existing fixture SQL naming mnweb/other roles must be reviewed and mapped rather than executed unchanged. Do not grant new app membership in any existing role.

## Recommendation

Keep the hosted option pending. Provider-free local full-profile/onboarding acceptance has now passed; see `1655-full-next-acceptance-2026-11-05.md`. The final supported-path assessment and compatibility recommendation are in `1655-final-compatibility-review-2026-11-05.md`. Before requesting hosted approval, establish a documented nontransactional operator path using already authorized access, or present an explicit supported alternative with its exact additional access scope. Do not turn uncertainty into a request to create resources and see what happens. The previously recorded two-artist/two-hour bounds and cleanup remain the proposed scope, not authorization.

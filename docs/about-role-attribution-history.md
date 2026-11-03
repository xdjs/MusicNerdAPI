# Database role attribution: tracked-history evidence

Read-only local investigation, 2026-11-03. No database connection, hosted logs, secret-manager values, credentials, external messages or live mutations were used in this pass.

## Proven from available tracked history

- Web commit `11cddef2bb723bd98385f3efcdea27a6c9b5b5d9`, dated 2025-12-15, is titled “Privy Authentication Migration - Phase 2: Database Schema (#932)”. Its message explicitly describes introspecting the then-production database into a baseline migration. Both its `drizzle/0000_broad_sentinels.sql:233` and schema declare `webmapdata_editor` SELECT-all and UPDATE policies on artists.
- Current baseline blame points at merge `cdb4dc94ee88aac4c0899b1d88f01d4618d96e9a`, dated 2025-12-19, “Merge staging: SEO fixes, security updates, and dependency upgrades (#939)”. Following the file history reaches #932. The merge/blame identity is not evidence of role ownership.
- A bounded all-local-ref history search of SQL, Markdown and YAML found no CREATE ROLE or GRANT statement mentioning either `webmapdata_editor` or `readonly_user`. The equivalent exact `readonly_user` history search found no match. Current tracked exact-role Markdown/SQL/YAML matches are only the baseline policies for `webmapdata_editor`.
- Current tracked Web `webmapdata` references outside schema/migration snapshots are an MCP design document and component/mock tests. They do not map the custom database role to a connection or application. Column use alone cannot attribute a database login.

Reproducible read-only searches (from the isolated Web checkout; no network fetch):

```sh
git log --all --format='%h %ad %s' --date=short -G 'webmapdata_editor|readonly_user' -- 'drizzle/*.sql' src/server/db/schema.ts
git log --follow --format='%h %ad %s' --date=short -- drizzle/0000_broad_sentinels.sql
git log --all --format='%h %ad %s' --date=short -G 'CREATE ROLE.*(webmapdata_editor|readonly_user)|GRANT.*(webmapdata_editor|readonly_user)' -- '*.sql' '*.md' '*.yaml' '*.yml' ':!drizzle/meta/*'
git log --all --format='%h %ad %s' --date=short -G 'readonly_user' -- '*.md' '*.sql' '*.yaml' '*.yml' ':!drizzle/meta/*'
```

These searches exclude credentials/env files, dependency contents and snapshot duplication. They are not a search of every remote branch, arbitrary binary, secret store, machine or external system. Multiline/dynamic provisioning or untracked operations can evade exact-pattern searches. No result is proof that provisioning never occurred.

## What remains unknown

Neither role's actual consumer, credential custodian, present traffic, full query contract or retirement safety is established. The earlier catalog inspection established access, not ownership; a lack of active sessions at one instant is not historical inactivity. The baseline is an imported database snapshot, not a provisioning/change-approval record. Do not assign ownership to its author or to an application merely because it uses webmapdata.

No nonsecret role-to-application ownership register was found in the tracked files searched. The next useful source would be an existing authorized provisioning/access inventory exposing only role name, application label, responsible-owner label and linked change record. No such accessible inventory has been established in this environment. Do not retrieve connection strings or secret values to infer the mapping. A separately available historical connection audit must support server-side field exclusion and account for pooled/effective roles; do not pull unrestricted logs for later redaction.

Until a mapping is established, preserve both roles' existing access and intended map editing. Their unknown raw-table interfaces remain a compatibility/privacy release gate for the guarded projection. Local synthetic tests cannot resolve their ownership.

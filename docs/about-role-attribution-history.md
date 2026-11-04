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

## Expanded checkout search, 2026-11-04

Read only tracked source/SQL/Markdown/YAML at each local HEAD, excluding dependency/vendor/lock/schema-snapshot files. No env or credential file contents were opened. Exact role-name searches and a separate filename-only `webmapdata` search found no matches in these checkouts:

| Checkout        | HEAD                                       |
| --------------- | ------------------------------------------ |
| MusicNerdMono   | `36b501b1ba9aed58bc0b9d3354cadfc91a121b06` |
| MusicNerdTV     | `56db805805aca29281a63c7b05e154c66865aa97` |
| mnagentflow     | `a8841ffa0a451615fa2b213e10c662141e52016b` |
| musicnerd-agent | `69cd909940f55bc86fc6c928271e8c3d0028c647` |
| musicnerd1      | `8d213f41e52fa487840bdbe76c69e1fe1af738d3` |
| musicnerd2      | `68407d84fca98b05b8024af149967936c28caf79` |
| musicnerd3      | `60a9612ed4d3977326903eee3112e333c56a4bea` |
| musicnerd3.1    | `02617d7504a3ffed8931ced55079af25a0031132` |
| musicnerd3.2    | `c1a8859c05b9bc5245cac2f386cd22b7753dcd34` |

This expands the bounded evidence; it still does not identify either role's consumer or prove there is none. No new hosted role/session inventory or historical logs were accessed. There is no evidence to treat an unidentified consumer as migrated, retired or safe to revoke. A synthetic map-writer test can establish which SQL contract works with restricted grants; it cannot establish that the real client uses that contract.

## Independently checked access shape, 2026-11-04

Read-only catalog query inspected only named roles' privilege booleans and `pg_policies` for artists; no artist rows, credentials, statements, client addresses or logs were read. This independently corroborates the parallel investigation's relevant policy claims:

| Target | Role | Base SELECT / bio SELECT | Artist SELECT policy | Map UPDATE grant/policy |
| --- | --- | --- | --- | --- |
| Dev | anon, authenticated | yes / yes | PUBLIC USING(true) | grant exists; no applicable UPDATE policy shown |
| Dev | readonly_user | yes / yes | PUBLIC USING(true) | no grant |
| Dev | webmapdata_editor | yes / yes | PUBLIC USING(true) | grant exists; no applicable UPDATE policy shown |
| Production | anon, authenticated | yes / yes | none shown for these roles | grant exists; no applicable UPDATE policy shown |
| Production | webmapdata_editor | yes / yes | role-specific USING(true) | grant and role-specific UPDATE USING(true) |
| Both | mnweb | yes / yes | role-specific USING(true) | grant and role-specific UPDATE USING/WITH CHECK(true) |

All listed roles are non-superuser/non-BYPASSRLS. anon/authenticated are NOLOGIN; custom readers and mnweb are LOGIN. Production's named-role result does not contain readonly_user. The query checks effective object privileges and displayed policies, not an exhaustive fresh membership/API/schema exposure audit. Synthetic replicas must reproduce these distinctions, not infer read visibility from grants alone or invent a Dev map-write policy. Production anon/authenticated must not gain all-row access through an owner-rights compatibility view.

The parent reports absent matching sessions/retained statements/24-hour connection events, with logging/retention limitations. Those log observations were not independently re-queried here, are not used to authorize a cutover, and do not establish disuse. No consumer or credential owner was identified by this catalog check.

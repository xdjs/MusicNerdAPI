# Public biography compatibility options

Local design investigation, 2026-11-03. Recommendation before implementation or live changes. Read with about-raw-reader-audit.md and about-release-readiness.md. No production migration, access change or projection implementation is included.

## Recommendation

Prefer a **separate guarded read projection**, retaining the existing artists base table and trusted writer paths. First define and test its biography policy against the existing application projector; then migrate any established direct readers and close their raw-table access in the same controlled cutover. Preserve the column names/types/order expected by SELECT * clients on the projection. Clients would change relation or schema/endpoint selection, not their result parsing. That is a smaller compatibility change than breaking their SELECT * response or replacing the shared writable artists relation.

A new view alone does not close today's raw-table bypass. Until clients transition and raw access is restricted, it is an optional safe interface, not remediation. No known client currently establishes a need to retain the literal qualified public.artists name. If that requirement is confirmed, revisit the compatibility view with a coordinated writer migration; do not assume it is free.

## Comparison

| Option | Read compatibility | Architecture impact | Privacy condition | Recommendation |
| --- | --- | --- | --- | --- |
| Separate guarded view (e.g. API schema artists) | Same result fields; relation/schema selection changes | Base table, FKs, writer SQL stay intact | Current guard on every read; remove raw access after transition | Preferred if direct database clients actually need a database interface |
| Same-name public.artists view over renamed/private base | Can preserve simple SELECT * shape | Writer mapping, computed-column updates, row locks, FKs/schema generation, API relationship inference and old versions need verification | Base inaccessible to untrusted users; full current guard, explicit view owner permissions | Only for a demonstrated unchanged-name requirement |
| Plain materialized view with periodic refresh | Stable read shape | Extra refresh lifecycle | Unsafe between withdrawal and refresh | Reject for privacy enforcement |
| Public cached bio plus private raw bio and synchronous invalidation | Can retain existing public table/column shape | Move all editor/writer/history access; triggers across every dependency; epoch/lease protocol | Invalidate atomically with every dependency mutation, generation must compare-and-set current epoch | Potentially safe but substantially broader than this fix |
| Safe-column grants only | SELECT * fails; explicit non-bio reads survive | Smallest DDL | Revoke table-wide grants before narrow column grants matter | Fallback if consumers accept query changes and use existing safe HTTP About |

## Guarded view requirements

The current authority is lib/bio/projectSavedPublicBio.ts plus publicVaultSourceSql.ts, vaultSourceRevision.ts and publicKnowledgeUrl.ts. A SQL projection cannot merely check approval or existence of a provenance row. It must match text hash, claim scope, authored/generated/unknown/legacy semantics, complete recorded vault revisions, source publication/moderation, immutable submission trust and safe citation URLs. Match JSON.stringify's exact revision bytes; PostgreSQL JSON formatting is not automatically the same serialization. Malformed/unknown lineage must yield null, never raw fallback. Guarded reads must be one snapshot.

Use explicit columns and roles. A default owner-rights view can read rows hidden by caller RLS; define intended row visibility and a least-privilege view owner. security_invoker alone cannot both deny raw access and magically supply private evidence access. A narrow privileged projector is possible but needs fixed search_path, exact execute grants, no arbitrary SQL/identifiers, public-only return values and adversarial tests. security_barrier is not a substitute for that policy. PostgreSQL explains these privilege and update distinctions in its [CREATE VIEW documentation](https://www.postgresql.org/docs/17/sql-createview.html).

Separate projection schema selection may work for qualified SQL or a Data API schema/header configuration, but actual exposed schemas, defaults, GraphQL and PostgREST relationship inference are not verified. Changing a default exposed schema globally can affect unrelated routes; do not use that as an assumed zero-change routing trick. Explicitly qualified public.artists bypasses search_path shadowing. Reusing a name does not preserve OIDs, composite types or API metadata.

## Why same-name replacement is not the smallest change

The Web schema contains many foreign keys to artists. Renaming a base relation preserves existing dependency identity, but future migrations must reference the base, not the replacement view. Drizzle currently declares artists as pgTable. Web artistQueries.ts inserts artists with onConflictDoNothing().returning(); API persistArtistBio and many profile/link writers update that table. A computed masked bio is not directly writable. Route trusted writers to the base, or implement and audit INSTEAD OF write triggers with exact authorization/RETURNING semantics.

Do not claim ON CONFLICT is universally unsupported on views: simple automatically updatable views can support it. The problem demonstrated here is the computed bio column and more complex projection shape, plus actual application contracts. Old writer/read deployments need the existing quiescence gate. Old readers can also retain prepared relation identity or base access after rename; test and revoke that access before reopening. Rolling back to the raw public table reintroduces the leak, so rollback must preserve the guarded public interface.

## Materialization and invalidation

A periodic refresh cannot enforce immediate withdrawal. PostgreSQL documents that [materialized views return stored, potentially stale results](https://www.postgresql.org/docs/17/rules-materializedviews.html). A safe stored projection would need synchronous invalidation on source status, publication, URL/content/identity edits or deletion; trust event changes; claim approval/revocation; current bio/provenance/history pin changes; and every relevant writer, including direct privileged SQL. Contributor whitelist loss must not erase submission-time trust. New publication needs an epoch/version compare-and-set so a worker cannot restore stale text after invalidation. Lock ordering must match the artist-first protocol. Invalidation failure must roll back the restrictive source change or otherwise block reads; asynchronous jobs alone cannot guarantee safety. Fail-closed invalidation may temporarily remove otherwise eligible About text until recomputed, which is a product/availability tradeoff. A dynamically guarded cache still needs the same read-time validator and becomes a performance choice, not a shortcut around provenance policy.

## Synthetic local probe

/tmp/mn-projection-design/probe.mjs and result.json use only synthetic rows and PGlite 0.5.8, reporting PostgreSQL 18.3 WASM. This is not a native PostgreSQL17 or production-policy test. A simple boolean eligibility flag stands in for the full guard solely to test structural compatibility.

- Same-name SELECT * returned id/name/bio, masking one restricted bio while keeping an allowed bio. Direct private-base read failed with 42501.
- Ordinary UPDATE bio and INSERT/upsert including bio failed with 0A000 because the view bio was computed. A name-only UPDATE succeeded.
- A new FK referencing the view failed with 42809.
- After eligibility withdrawal, the dynamic view returned null while an unrefreshed materialized view still returned the old biography.

The earlier native PostgreSQL14 suite validates current sidecars/concurrency, not this proposed interface. PostgreSQL17 remains unavailable locally. No provider or live database was used for this probe.

## Known clients and remaining decision

The previous audit checked current API/Web handlers and local MusicNerdTV and mntv-artist-staging implementations at recorded SHAs. Core public HTTP About, lookup, MCP and Web readers already project safely. TV reads/generated artist_cache JSON; no matching core artists-table reader was found in the inspected paths. Docs establish HTTP consumers including SleeveNote, not a complete direct SQL inventory. webmapdata_editor's actual consumer remains unidentified. Preserve its intended non-bio access unless evidence authorizes a change.

No known inspected client requires the broad same-name migration today. Confirm whether any direct reader needs (a) a database interface, (b) exact qualified table name, (c) write access, or (d) GraphQL/embedded relation compatibility. That answer selects the minimum necessary interface. Before release: differential policy tests, public-role denied-base/allowed-view tests, adversarial predicates/functions, source/claim races, genuine PostgreSQL17 execution, target metadata/access audit, client contract tests and coordinated upgrade/rollback rehearsal.

# Guarded About read projection: isolated prototype

**Not a release migration.** No application imports this SQL; it is not in the Drizzle migration journal. Tests create an in-memory PGlite database with synthetic records and roles. Never apply projection.sql directly to a real database.

Run from MusicNerdAPI with existing dependencies:

```sh
node node_modules/vitest/vitest.mjs run docs/prototypes/guarded-about/projection.test.ts
```

The prototype exposes `mn_public.artists(id,name,bio)` while preserving raw text for the trusted `mnweb` role. A NOLOGIN/NOBYPASSRLS projection owner has SELECT-only access through explicit RLS policies; a fixed-search-path privileged function returns only validated biography text. Public roles receive view SELECT and narrow function EXECUTE, but no private schema USAGE. The view preserves identity rows and masks ineligible bio to null. It adds no public write capability.

A synthetic cutover removes table SELECT from anon/authenticated/PUBLIC and rejects leftover column grants or inherited trusted-role access. It does not enumerate all real roles/default grants/views or identify external clients. Real cutover requires that inventory and explicit target-specific grants; `webmapdata_editor` and service roles must not be silently reassigned.

## Tested

Nine regressions cover anon, authenticated, an inherited anonymous role and the trusted app; denied raw/provenance reads, denied writes and direct private-function calls; SELECT * fields; dynamic private/rejected/content-changed sources; old-writer text/hash mismatch; SHA revision parity with JavaScript for nullable text, quotes, controls, Unicode and real date fields under a non-ISO session DateStyle; legacy claimed-only behavior; unknown/malformed or unsupported provenance; immutable trust removal; claim revocation; atomic failed migration rollback; and leftover column-grant rejection.

After successful cutover, the tested emergency rollback keeps the view and denied raw grants, replaces its function with a null-bio implementation, and preserves raw editor text. This sacrifices public bio availability without restoring leakage. A failed pre-cutover transaction restores the previous raw grants: traffic must remain gated and operators must not claim the new protection. Production execution must use an explicit transaction; the SQL file is a prototype fragment, not a runner.

PGlite 0.5.8 reports PostgreSQL18.3 WASM, not PostgreSQL17. These sequential tests exercise dynamic visibility, not genuine multi-session race scheduling, deployed PostgREST/GraphQL or performance. Earlier native17-case concurrency tests cover the application sidecars, not this new projection. Native PostgreSQL17 is unavailable.

## Deliberately incomplete policy parity

The SQL is a conservative vault-only proof, not a reimplementation ready for real bios. It rejects interview/social manifests, empty evidence (including some claimed cases), and URLs containing queries/fragments/escapes, ports or IDNA labels or outside a narrow simple HTTP(S) pattern. It lacks full WHATWG URL validation and the full range of valid public URLs and non-vault policy semantics. Exact JS trim whitespace and the current About placeholder are covered by regressions. Rejected otherwise-valid biographies disappear from this interface. Legacy/null evidence is claim-gated as in the app; historical privacy cannot be reconstructed.

Revision hashing mirrors the current array-of-nullable-text serialization and the included corpus, but must be expanded to all actual database types/encodings before parity is claimed. Malformed policy inputs must never fall back to raw text.

## Release requirements and client compatibility

The known Web/API public routes already use the application projection. Inspected TV checkouts use artist_cache; no actual direct core-table client has been identified. SleeveNote is documented as an HTTP consumer; that does not rule out unknown SQL, PostgREST, GraphQL, scripts or cached consumers. Consult about-raw-reader-audit.md.

A client can retain SELECT * parsing at the new relation but must change its query relation/schema or API selection. The synthetic three-column shape is not the full artists schema: production needs an explicitly reviewed complete column contract, including column order/types and embedded relations, without inventing exposure of other fields. Old raw access must close in the same authorized cutover. A parallel view alone does not repair the bypass.

Before any release: full differential policy tests, client/role inventory, target schema and privileges (including default/inherited grants and privileged forwarders), native PostgreSQL17 concurrency tests for source/claim/trust changes and withdrawal, real API schema discovery tests, query-plan/performance evaluation, migration failure and gated rollback rehearsal. Keep old writers/readers quiesced during transition. This prototype changes no current production or application behavior.

Final local run: **9 passed in 4.17 seconds**. Independent review identified the initial date/URL/whitespace parity gaps; regressions now cover those fixes. This is prototype evidence only, not approval to migrate real data.

TypeScript and focused ESLint passed. Final independent review confirmed the date, whitespace, URL/IDNA and inherited-grant findings are resolved within this prototype scope. No application build or full-suite rerun was needed for these isolated files.

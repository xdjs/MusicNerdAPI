# Guarded About projection: isolated parity prototype

**Not a release migration.** No application imports this SQL; it is outside the Drizzle journal. Tests create in-memory PGlite databases with synthetic records and roles. Never apply projection.sql directly to a real database.

Run from MusicNerdAPI with existing dependencies:

```sh
node node_modules/vitest/vitest.mjs run docs/prototypes/guarded-about/projection.test.ts docs/prototypes/guarded-about/apiCompatibility.test.ts
```

## Current behavior and evidence

`mn_public.artists(id,name,bio)` preserves identity rows and masks ineligible biography text to null. Trusted mnweb writers retain raw text. The projection owner is NOLOGIN/NOSUPERUSER/NOBYPASSRLS with SELECT-only access and explicit RLS policies. A privileged function has a fixed search_path and qualified objects; public roles receive view SELECT and narrow function EXECUTE, but no private schema USAGE or write ability. A security barrier does not replace the explicit guard.

The current local run passed **18 tests across two files in 6.41 seconds**. Types and focused lint also passed. Tests cover public/authenticated/inherited roles, trusted raw access, SELECT * fields, denied raw/provenance reads and view writes, source privacy/moderation/content changes, old-writer hash mismatch, legacy claim scope, immutable trust removal and claim revocation. Migration failure rolls back atomically; leftover inherited column grants and an unidentified raw-reading login block cutover. Post-cutover emergency rollback retains denied raw access and the view, returns null biographies, and preserves editor text. A failed pre-cutover migration restores previous unsafe access; traffic must stay gated.

Differential checks against the existing JS projector now cover claimed generated and authored empty manifests, interview/social/vault evidence, null source URLs, unknown kinds, wrong claim scope, duplicate/fractional/unsafe source ids, and URL cases. Revision tests compare actual vaultSourceRevision bytes for nulls, controls, quotes, Unicode and a real date column under a non-ISO session DateStyle. Source IDs are compared numerically; arbitrary high-precision JSON decimals are treated more strictly than JS binary64 rounding and are not claimed fully equivalent.

Five tests invoke the real About GET, legacy lookup and MCP detail handlers through a **test-only getPublicSavedBio adapter** that reads the SQL view as anon. They verify unchanged JSON shapes, ordinary successful no-store responses, safe fallback, withdrawal, 404 and projection failure. Providers/auth and unrelated DB operations fail if accidentally invoked. This proves handler compatibility under those fixtures, not a listening HTTP server, production wiring, full artist-row schema, PostgREST or GraphQL discovery/embedded relations.

## Remaining policy parity blocker

The SQL accepts ordinary ASCII domain HTTP(S) URLs, valid numeric ports, path escapes, benign queries and fragments. Secret-bearing query names are rejected. It deliberately rejects percent-encoded query names (even benign ones), IDNA, Unicode hosts, IP literals and other forms outside its bounded grammar. Full WHATWG URL/URLSearchParams parity is **not achieved**; valid bios can be withheld. The corpus checks supported cases against publicKnowledgeUrl and verifies that unsupported encodings fail closed. This is unsuitable for production replacement until URL behavior is resolved and a broader differential/fuzz corpus passes.

Independent design review recommends considering a private, versioned validation receipt written by the existing JS validator and bound to exact URL/provenance bytes, with SQL checking the receipt plus current source eligibility/revisions. That avoids duplicating browser URL parsing, but adds a reviewed writer/schema contract, strict receipt privileges, atomic publication and rollout/backfill requirements. Missing or stale receipts must hide text; old writers cannot reuse receipts for different bytes. No receipt mechanism was implemented speculatively. Legacy provenance still cannot honestly be reconstructed.

## Concrete access risks from read-only catalog inspection

Both inspected projects have public-schema default table privileges for anon, authenticated and service_role, and function EXECUTE defaults for those roles. Dev also has readonly_user default read grants. These are schema/creator-specific, not proof that new private schemas inherit the same grants. Inspect actual ACLs and migration creator at rollout; never rely only on defaults or schema names.

Dev readonly_user and webmapdata_editor are LOGIN roles with schema USAGE and artist SELECT, without superuser/BYPASSRLS. With Dev's PUBLIC artist-read policy, they are additional raw-bio paths. Their consumers were not identified in the inspected code. webmapdata_editor also has its intended webmapdata UPDATE grant. Do not silently revoke that editing contract. The prototype postflight rejects unexpected non-superuser login readers and anon/authenticated raw access, including NOINHERIT membership paths that permit SET ROLE into a raw reader; real service/API role memberships and non-login assumable roles need a complete audit.

Artist table grants also include INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for anon/authenticated in the inspected metadata. RLS remains relevant to row operations; these broad grants are a separate hardening review, not evidence that every operation is reachable through the public Data API. None was exercised. The projection prototype only addresses its defined read boundary.

Known HTTP clients can retain their contract through existing safe handlers. The inspected TV implementations use artist_cache rather than a demonstrated core artists-table client. Unknown SQL/PostgREST/GraphQL consumers, readonly_user, webmapdata_editor, historical scripts and caches remain unverified. See the bounded checkout evidence in about-raw-reader-audit.md.

## Release sequence and environment blockers

1. Resolve URL parity or review the receipt design; run full differential and adversarial cases. This prototype is not yet a drop-in policy implementation.
2. Identify role owners/clients and agree the new relation/schema contract, including all public column names/types/order and API relationship metadata. The prototype tests only three fields. Verify consumer behavior before changing their grants.
3. Audit actual/default/inherited grants, privileged forwarding functions and API schema exposure; explicitly classify trusted service roles. No inferred allowlist.
4. Rehearse transactional migration and genuine multi-session source/claim/trust races on native PostgreSQL17 with target-equivalent schema/roles. Then test the actual authorized API/GraphQL environment. Keep providers stubbed unless approved.
5. Gate traffic/old workers; deploy compatible writers/readers and switch approved clients; restrict old raw paths in the same controlled cutover. Dual-interface access while raw grants remain is still exposure, not completed protection.
6. Verify every role and reopen only when guards are effective. On failure, retain the interface/raw denial and fail closed; never restore a raw public reader as an availability shortcut. Record compatible rollback artifacts and evidence.

Only PostgreSQL14.18 is available via the inspected local install. Docker CLI exists, but its daemon cannot be reached; no image inventory or PG17 container was verified. No daemon was started, software installed, image pulled, or live database written. PGlite0.5.8 reports PostgreSQL18.3 WASM; it is not native PostgreSQL17. Sequential withdrawal tests are not multi-session race proof. Application behavior and the production migration chain remain unchanged.

Final review found and corrected the NOINHERIT/SET ROLE escape in the initial grant guard. Its regression verifies the login has no inherited SELECT yet cutover still aborts because a reachable role can read raw text.

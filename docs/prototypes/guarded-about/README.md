# Guarded About projection: isolated parity prototype

**Not a release migration.** No application imports this SQL; it is outside the Drizzle journal. Tests create in-memory PGlite databases with synthetic records and roles. Never apply projection.sql directly to a real database.

Run from MusicNerdAPI with existing dependencies:

```sh
node node_modules/vitest/vitest.mjs run docs/prototypes/guarded-about/*.test.ts
```

## Current behavior and evidence

`mn_public.artists(id,name,bio)` preserves identity rows and masks ineligible biography text to null. Trusted mnweb writers retain raw text. The projection owner is NOLOGIN/NOSUPERUSER/NOBYPASSRLS with SELECT-only access and explicit RLS policies. A privileged function has a fixed search_path and qualified objects; public roles receive view SELECT and narrow function EXECUTE, but no private schema USAGE or write ability. A security barrier does not replace the explicit guard.

The current local run passed **27 tests across three files in 8.04 seconds**. Types and focused lint also passed. Tests cover public/authenticated/inherited roles, trusted raw access, SELECT * fields, denied raw/provenance reads and view writes, source privacy/moderation/content changes, old-writer hash mismatch, legacy claim scope, immutable trust removal and claim revocation. Migration failure rolls back atomically; leftover inherited column grants and an unidentified raw-reading login block cutover. Post-cutover emergency rollback retains denied raw access and the view, returns null biographies, and preserves editor text. A failed pre-cutover migration restores previous unsafe access; traffic must stay gated.

Differential checks against the existing JS projector now cover claimed generated and authored empty manifests, interview/social/vault evidence, null source URLs, unknown kinds, wrong claim scope, duplicate/fractional/unsafe source ids, and URL cases. Revision tests compare actual vaultSourceRevision bytes for nulls, controls, quotes, Unicode and a real date column under a non-ISO session DateStyle. Source IDs are compared numerically; arbitrary high-precision JSON decimals are treated more strictly than JS binary64 rounding and are not claimed fully equivalent.

Five tests invoke the real About GET, legacy lookup and MCP detail handlers through a **test-only getPublicSavedBio adapter** that reads the SQL view as anon. They verify unchanged JSON shapes, ordinary successful no-store responses, safe fallback, withdrawal, 404 and projection failure. Providers/auth and unrelated DB operations fail if accidentally invoked. This proves handler compatibility under those fixtures, not a listening HTTP server, production wiring, full artist-row schema, PostgREST or GraphQL discovery/embedded relations.

## URL parity through private validation receipts

The SQL URL parser has been removed. `prepareUrlReceipt.ts` invokes the unchanged application `publicKnowledgeUrl` validator and records accepted original UTF-8 bytes, their SHA-256 hash and policy version 1 in a private receipt table. The SQL read requires that exact byte/hash/version match, plus all existing source, provenance, text-hash and claim checks. A receipt certifies URL-policy acceptance only; it does not approve a source or grant publication authority.

This closes the duplicated-parser gap for PostgreSQL-representable inputs: IDNA/Unicode hosts, IP forms, encoded query names, whitespace, ports and fragments are decided by the same Node WHATWG implementation as the existing application. Rejected credential-bearing/secret-query URLs produce no receipt. PostgreSQL text cannot contain NUL or unpaired UTF-16 surrogate strings; the helper refuses those before insertion. Do not describe them as representable source records with a separate URL policy. Exact original bytes matter: a normalized-looking replacement cannot reuse a receipt for another string.

The receipt helper accepts the same transaction writer used for publication. Tests show receipt+publication rollback together, missing/stale/tampered/deleted receipts hide text, and anonymous roles cannot read or forge receipts. mnweb can INSERT and SELECT receipts but cannot UPDATE/DELETE them; the projection role only reads. These are trusted application-role privileges, not user-level authorization. Production writers must call the helper atomically; no read-time receipt writes or real application integration have been added.

Policy version and Node/runtime semantics are part of the contract. A validator change requires explicit version rollout/revalidation; old receipts must not be silently accepted under stricter rules. Existing generated biographies need an approved receipt-preparation step using current bytes before switching readers. Do not invent legacy provenance, overwrite text, refresh sources or call models. The remaining blocker is production integration/rollout and broader evidence-policy verification, not a second SQL URL grammar. Arbitrary high-precision JSON numbers and native engine behavior still have the documented parity limits.

## Concrete access risks from read-only catalog inspection

Both inspected projects have public-schema default table privileges for anon, authenticated and service_role, and function EXECUTE defaults for those roles. Dev also has readonly_user default read grants. These are schema/creator-specific, not proof that new private schemas inherit the same grants. Inspect actual ACLs and migration creator at rollout; never rely only on defaults or schema names.

Dev readonly_user and webmapdata_editor are LOGIN roles with schema USAGE and artist SELECT, without superuser/BYPASSRLS. With Dev's PUBLIC artist-read policy, they are additional raw-bio paths. Their consumers were not identified in the inspected code. webmapdata_editor also has its intended webmapdata UPDATE grant. Do not silently revoke that editing contract. The prototype postflight rejects unexpected non-superuser login readers and anon/authenticated raw access, including NOINHERIT membership paths that permit SET ROLE into a raw reader; real service/API role memberships and non-login assumable roles need a complete audit.

Artist table grants also include INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for anon/authenticated in the inspected metadata. RLS remains relevant to row operations; these broad grants are a separate hardening review, not evidence that every operation is reachable through the public Data API. None was exercised. The projection prototype only addresses its defined read boundary.

Known HTTP clients can retain their contract through existing safe handlers. The inspected TV implementations use artist_cache rather than a demonstrated core artists-table client. Unknown SQL/PostgREST/GraphQL consumers, readonly_user, webmapdata_editor, historical scripts and caches remain unverified. See the bounded checkout evidence in about-raw-reader-audit.md.

## Release sequence and environment blockers

1. Review and integrate the receipt writer into every production publication path; run full differential/adversarial cases and explicitly version validator/runtime semantics. This prototype is not yet a drop-in deployment.
2. Identify role owners/clients and agree the new relation/schema contract, including all public column names/types/order and API relationship metadata. The prototype tests only three fields. Verify consumer behavior before changing their grants.
3. Audit actual/default/inherited grants, privileged forwarding functions and API schema exposure; explicitly classify trusted service roles. No inferred allowlist.
4. Rehearse transactional migration and genuine multi-session source/claim/trust races on native PostgreSQL17 with target-equivalent schema/roles. Then test the actual authorized API/GraphQL environment. Keep providers stubbed unless approved.
5. Gate traffic/old workers; deploy compatible writers/readers and switch approved clients; restrict old raw paths in the same controlled cutover. Dual-interface access while raw grants remain is still exposure, not completed protection.
6. Verify every role and reopen only when guards are effective. On failure, retain the interface/raw denial and fail closed; never restore a raw public reader as an availability shortcut. Record compatible rollback artifacts and evidence.

Only PostgreSQL14.18 is available via the inspected local install. Docker CLI exists, but its daemon cannot be reached; no image inventory or PG17 container was verified. No daemon was started, software installed, image pulled, or live database written. PGlite0.5.8 reports PostgreSQL18.3 WASM; it is not native PostgreSQL17. Sequential withdrawal tests are not multi-session race proof. Application behavior and the production migration chain remain unchanged.

Final review found and corrected the NOINHERIT/SET ROLE escape in the initial grant guard. Its regression verifies the login has no inherited SELECT yet cutover still aborts because a reachable role can read raw text.

Final receipt review found no remaining blocker within this isolated scope. The hash/version-only key avoids indexing long URL values; a 25 KB URL passes and conflicting stored bytes abort the publication transaction. See [staging and rollout plan](staging-plan.md) for confirmed role facts, unknown consumers and native PostgreSQL17 options.

## Production integration decision

[Integration assessment](integration-assessment.md): retain this as an isolated prototype until the role/client and interface decisions are resolved. `atomicWriter.test.ts` now decorates the actual API publication writer with receipt preparation on the same transaction. It verifies real About/Lore/history/lineage/lease writes, storage/conflict rollback and source withdrawal. Policy-rejected historical URLs do not block manual edits; they receive no receipt and stay publicly hidden. This is test-only integration evidence, not active application wiring or deployed end-to-end proof. Unknown-role access remains untouched.

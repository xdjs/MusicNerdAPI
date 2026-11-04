# Legacy About: preserve storage, require known public lineage

Local candidate, 2026-11-04. Recommendation: remove the claim-only legacy exception from public readers. Keep every saved biography, pin and history row intact for authorized editors. A claim establishes editing authority; it does not establish which sources an old biography used or that its text is safe to republish.

## Implemented policy

The API/Web public projectors and guarded SQL now agree:

- Missing/null provenance is not publicly eligible, even with an approved claim.
- Generated provenance must contain evidence; an empty source list is insufficient even on a claimed artist.
- Explicit supported authored provenance may have no external sources, but must match the exact biography hash and current claim. Existing recorded evidence, when present, still must pass the normal eligibility/revision checks.
- Invalid, unknown, stale or withdrawn lineage remains hidden. Claiming, editing or pinning old text does not manufacture authorship, evidence or URL receipts.

Public profiles, metadata, share output and API/MCP responses use guarded reads. An explicitly empty server biography wins over stale client cache contents. Authorized owner/admin editing still receives raw saved text; tests assert legacy/pinned bytes are unchanged. Existing public empty states suffice; no new UI or automatic reclassification is introduced.

This is a local visibility change, not a data migration. There is no deletion, historical source reconstruction, blanket receipt backfill, model call or live policy flip. The compatibility cutover still refuses unknown raw readers; the application guard does not repair an independently granted raw table interface.

## Recovery path and decision

Recommend approving the conservative public hide at rollout. For each affected claimed biography, an authorized editor can regenerate from eligible current Lore through #1655's fixed action. Artists without usable Lore need approved readable material first. Current source records are a regeneration input, NOT proof of which sources produced historical prose. A pinned biography is intentionally not overwritten; its owner must make an explicit unpin/regeneration decision.

If retaining exact legacy prose publicly is required, it needs an explicit human review/publication decision and an auditable mechanism that records that decision. This change does not offer a new “reviewed legacy” action and does not silently label old text as authored. Merely saving an edit to an unknown legacy biography retains unknown lineage and does not make it public. A URL receipt alone cannot solve missing provenance. Existing explicit authored-lineage workflows remain supported, but there is no automatic conversion path for arbitrary legacy pins.

The product decision belongs to Pete/the issue's release owner: accept temporary public hiding until review/regeneration, or require a separately reviewed legacy-publication workflow before release. The aggregate read-only impact is reported in the task conversation rather than storing target data in this public repository. Counts of current sources cannot establish historical provenance or guarantee successful regeneration.

One secondary effect: correction reports that operate on a published About cannot open newly hidden legacy text. The normal authorized editor remains available. This preserves the same boundary rather than creating an indirect read fallback.

## Evidence and environment

API full suite: 4,838 passed, 28 skipped; focused policy/SQL comparison tests, types, lint and independent review passed. Web: 151 focused tests plus six hook tests passed, with types/lint and independent review. These include actual public database getters, profile metadata, authorized owner access and stale-cache suppression. Previous complete Web suite/build and native PostgreSQL14 receipt tests predate this small visibility delta; they are not relabeled as reruns.

The local comparison fixture records the old and new policy outcomes without touching real rows. No API/Web writer was changed to infer authorship. PostgreSQL17 remains unavailable in the inspected local locations: Homebrew has14.18, no standard Postgres.app/Library/usr-local PG17 installation was found, and both existing Docker contexts have unavailable daemons. No PG17 service appears in the checked-in GitHub workflow search. No software or image was installed, no Docker daemon started, and no remote test database was used.

## Concrete role-owner route

The documented first lead is Carl, author of the initial database-introspection import in Web commit `11cddef2bb723bd98385f3efcdea27a6c9b5b5d9` / PR#932 and merge `cdb4dc94ee88aac4c0899b1d88f01d4618d96e9a` / PR#939. This proves who imported the policy snapshots, not who owns the credentials.

Ask the schema/provisioning custodian to identify the issuer and application operator for webmapdata_editor and Dev readonly_user using existing nonsecret account/provisioning labels. Obtain the actual qualified read relation, selected fields, map write/RETURNING columns and maintainer confirmation. If Carl did not provision them, his useful role is to route that question to the custodian. No one was contacted in this task, and neither role owner has been inferred from authorship or absent logs.

A verified client mapping and narrow query contract are needed to migrate the roles safely; broad read grants must not be retained as an undocumented privacy exception. Native17 verification needs an operator-supplied approved existing runtime or a separately authorized provisioning action, not speculative commands against a shared target.

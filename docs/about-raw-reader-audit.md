# Raw biography reader audit

Read-only audit resumed 2026-11-03 after the Mac reconnected. API baseline `c372703be541470c86c21d82347dbe110a68a2bb`; Web baseline `5ec2be6e65b1c37c7af19ef122996e88238cdec6`. Both isolated worktrees were clean. No live writes, provider calls, grants, deployment or publication occurred.

## Application paths

Public About GET (`lib/bio/getArtistBioHandler.ts`), lookup (`lib/artistLookups/findArtistHandler.ts`) and MCP detail (`lib/mcp/toArtistDetail.ts`) project stored text through `getPublicSavedBio`. Lookup replaces the raw row's bio before returning it. Search uses explicit fields without biography (legacy search returns bio:null); MCP summaries return id/name.

The interrupted generic-route review is now complete for these bounded paths:

- `lib/artistData/getArtistDataHandler.ts` requires admin; summary helpers return counts/coverage, not biography text.
- `lib/knowledgeExport/getKnowledgeDocExportHandler.ts` requires artist-edit authorization before reading; exports artist name and Lore, not stored bio.
- `lib/directoryDiscovery/getDirectoryDiscoveryStatus.ts` requires creator/admin; returns state and destination-link revision, not raw bio.
- `lib/discovery/discoverArtistProfilesStream.ts` retains the row internally; candidate validators construct explicit profile-card fields without bio.
- `postArtistChatHandler` uses the broad loaded artist only for name. Evidence comes from public-source tools and their revalidation, not stored bio.
- `lib/questions/generateGroundedQuestions.ts` uses artist identity/source signals, not stored biography. `lib/onboarding/buildProfilesPayload.ts` returns explicit name/link/enrichment fields. Image responses are redirects without a row body.
- Directory preparation records startingBio as a freshness comparison. Draft generation uses source manifest text, not that stored biography.

Web profile metadata, anonymous props and JSON-LD use safe projection. Editors intentionally retain raw text. SeoArtistLinks emits names/links only. Production share cards omit bio; proposal cards use guarded text with private,no-store. Search queries exclude bio. Web's Supabase helper is server-only storage admin; no browser artist-table reader was found in the inspected source.

Authorized regeneration, editing, private knowledge, corrections, onboarding, reset backup and history remain intentional raw readers. Keep those authorization boundaries; indiscriminate replacement with public text would lose editor content. This is a bounded call-site audit, not proof about every external deployment or future dynamic serializer.

## Database metadata evidence

Read-only catalog queries in the XDJS Music Nerd and Music Nerd Dev projects found:

- anon/authenticated/webmapdata_editor have no MEMBER or USAGE path into mnweb, postgres or service_role. authenticator is NOINHERIT and can assume API roles; service_role is BYPASSRLS and remains a trusted credential boundary.
- No inspected non-system view or materialized view definition references artists.
- Artist-referencing catalog functions are private catalog-identity helpers, not biography readers; anon/authenticated cannot execute them.
- All 53/94 public-role executable functions inspected in public and the app's private schemas are non-security-definer; none of their bodies references artists or bio. This does not prove absence of all dynamic SQL elsewhere.
- No pgrst.db_schemas setting appeared in database-role settings. That absence does not establish the platform's Data API configuration or disable GraphQL.
- Dev has PUBLIC artist SELECT USING true plus table SELECT grants. That permits raw biography reads without application evidence validation. Production's inspected artist policies instead allow mnweb/webmapdata_editor; do not apply Dev's conclusion indiscriminately to production anonymous access.
- History/source SELECT grants alone are not a confirmed anonymous leak: their inspected RLS policies allow mnweb, not public users.

Web docs/development/artist-profile-protection-release.md explicitly records historically intended public artist reads and GraphQL discoverability warnings. The webmapdata_editor policy exists in schema, but no consumer implementation was identified in the inspected app/scripts. Its read requirements remain unresolved.

## Compatibility decision

Keep existing safe HTTP response shapes. API guides document SleeveNote and other external clients; that establishes HTTP consumers, not a complete direct database client inventory or present deployment status. Do not infer that unused-looking roles or direct endpoints have no consumers.

The smallest database repair, if direct-client query changes are acceptable, is target-specific replacement of affected table SELECT grants with explicit safe column grants excluding raw bio, preserving other columns/RLS and trusted server access. A column-level revoke cannot override a table-wide grant. SELECT * clients would fail, so this is not silently backwards-compatible. Move biography requests to the existing safe HTTP endpoint, or define a reviewed safe database projection if such clients demonstrably require one. Do not hide whole artist rows via RLS to solve a biography-column problem.

If unchanged direct SELECT * compatibility is required, a private raw-text store and public projection/invalidation design is broader work. It must preserve legacy/manual/editor text and validate source changes transactionally; a cached public bio without complete invalidation would reintroduce leakage. That design should follow an explicit consumer contract, not be introduced speculatively.

No new app patch is justified by the inspected paths. Direct access remains a release blocker pending consumer/role ownership and compatibility decisions. Independent design review agrees with this boundary. PostgreSQL 14 remains the only server version found locally; PostgreSQL 17 verification is still unavailable.

## Bounded external checkout evidence

Read-only inspection covered MusicNerdTV at `56db805805aca29281a63c7b05e154c66865aa97`, mntv-artist-staging at `e5ed47df9aabaef9a8ee08591ff3e3084a8b70ef`, Mono at `36b501b1ba9aed58bc0b9d3354cadfc91a121b06` and Docs at `c05eb1ee5523ffc7d9318484699280dc98a0815d`.

Both TV checkouts use `supabase/functions/spotify-artist/index.ts` and `findCrossServiceBio` to read cached JSON from `artist_cache`, reuse bio after canonical-name/genre checks, or generate a new one. Their migrations create that cache with public reads and add service/canonical-name support. Focused src/supabase searches found no matching direct core artists/artist_bio reads, REST paths or MusicNerd HTTP bridge. This identifies the inspected implementation path, not physical database/project separation or deployment state.

Mono tracks API/Web/Docs/Skills. Docs contains HTTP references (including knowledge brief/sources and openapi/knowledge.json), not a direct-client inventory. No dependency-wide, historical-client, traffic or credential/configuration audit was performed. These findings do not establish the absence of direct consumers or authorize blanket revocation.

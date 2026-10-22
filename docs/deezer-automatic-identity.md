# Automatic Deezer identity — #1580

Automatic profile linking requires an exact, unique Wikidata pair between the artist's existing Spotify ID and proposed Deezer ID. Names, follower counts and caller-supplied mapping confidence do not prove identity. Different display names are allowed when the exact pair is corroborated. Missing IDs, missing/ambiguous relationships and lookup failures leave the candidate unconnected; explicit confirmation remains available. The lookup is bounded to four seconds and eleven rows; reaching the row cap abstains. This deliberately trades automatic coverage for avoiding wrong catalogs.

The automatic gate preserves any different Deezer link already present. The final write atomically checks that both catalog slots still match the verified snapshot; a concurrent edit causes rejection rather than an overwrite.

Explicit artist-confirmed link writes keep their existing authorization and collision checks. Existing connections and Latest snapshots are not rewritten. This prevents an automatic attachment class; it does not establish which path attached Rnd1's historical ID or correct production data. The MCP mapping follow-up below guards Deezer mapping persistence separately.

Tests use synthetic Wikidata responses, including the different-name alias case. They are not empirical proof of a real alias. No live provider calls are required for local verification. A deployed build would make the public Wikidata lookup for automatic Spotify and Deezer attachment. No paid provider or new configuration is used.

The original guard is published in draft API#86 at `80a5390` with passing CI and a ready preview. The MCP follow-up below extends that guard to mapping persistence; exact-SHA authenticated artist-flow preview checks remain pending. Verify 390x844 phone (2x/touch) and 832px desktop, light/dark: unresolved candidates are not connected, explicit confirmation succeeds, collisions remain rejected, and existing catalogs remain unchanged. API landing-page smoke checks do not establish artist-flow or phone acceptance.

## Spotify discovery prevention

Generic automatic Spotify profile attachment also requires corroboration against the existing Deezer ID. Name-search rankings and candidate reasoning are insufficient. A different existing Spotify account is preserved, and persistence rechecks both observed catalog slots. Explicit confirmation retains ownership and collision checks. The separate recording-based spotify_match worker keeps its existing evidence and eligibility rules. This does not establish that an existing anchor belongs to the human artist; historical wrong anchors require separate correction.

The same provider-specific corroboration and snapshot checks apply to research's shared link writer. Other platform adoption behavior is unchanged. Neither generic discovery nor research can bootstrap the first catalog ID without an existing reciprocal anchor; explicit confirmation and the separately verified recording matcher remain available.

Blocked research candidates may be skipped rather than retained in a review queue; this change does not introduce a persisted confirmation queue.

## October 22 integration path

This local API62 refresh starts from main `9f8f3ae`, including the merged API82 link routes and API84 bio routes. Preserve `setArtistLink(id, site, value, selfEditUrl?, transaction?, evidence?)`: automatic callers pass evidence last, manual/review callers retain their URL and supplied transaction. A successful changed write cancels matching work and records a self-edit within the same transaction; stale evidence records no edit. Audit failure rolls back the write.

This is the identity-only successor candidate for API62, paired with the existing Web1588 legacy guard until Sweetman's #1589 cutover. API85 already contains the old API62 prerequisites: its owner must consume the reconciled prevention and remove the duplicate prerequisites before merging. This branch does not import editor-search endpoints, source-writer compatibility, upload routes or migration work. No competing API85 merge is proposed.

Synthetic local regressions cover evidence, stale reciprocal/destination slots, permissions, direct/mapping collisions, caller transaction reuse and audit rollback. They mock public responses and use in-memory PGlite; they do not prove live authentication, deployed RLS, empirical alias coverage or the original Rnd1 write path. Existing Rnd1 correction and owner acceptance remain separate. No migration or existing-record rewrite is included.

Clearing a first-class catalog link does not remove its mapping row. A retained mapping can reappear as a discovery candidate, but automatic attachment still requires fresh corroboration; mapping confidence is not evidence. It can also block a different explicit replacement through the existing collision guard. This prevention patch does not claim normal link clearing reconciles mappings; correction requires its own reviewed mapping disposition.

## MCP mapping follow-up

The API-key-only `resolve_artist_id` contract has no artist-owner confirmation evidence. Its source, confidence and reasoning fields are caller assertions, including `manual`. Every actual Deezer mapping insert or update therefore requires the same fresh unique Spotify/Deezer pair corroboration. This includes same-ID confidence, source and reasoning updates; a confidence upgrade can make a retained candidate active again. A lower-confidence skipped request persists nothing and does not query the provider. Other supported mapping platforms and authenticated owner/direct link-edit paths keep their existing behavior; Spotify is not a supported mapping target and is not added.

Verification runs after current collision and confidence checks in the existing mapping transaction. Before persistence, a conditional `SELECT ... FOR UPDATE` locks the artist row only if both observed catalog slots still match. The existing artist/platform advisory lock serializes mapping writers; the row lock holds the verified catalog snapshot through commit. Missing/ambiguous/unavailable proof or changed slots reject without mapping persistence. The reused public lookup is bounded to four seconds; it adds that bounded network wait to a mapping transaction. No migrations, fallback name matching or new credentials are introduced.

Regressions reconstruct the public Rnd1/RNDN IDs and observed `name_search`/`medium` metadata including the captured stored reasoning, with mocked provider responses. They do not assert the current live Wikidata answer or prove the original first-class link-write path. Snapshot-change tests use an in-transaction simulated row change, not real concurrent PostgreSQL sessions. The existing bad mapping and link are not corrected by this code.

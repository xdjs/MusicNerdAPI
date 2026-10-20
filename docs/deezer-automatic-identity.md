# Automatic Deezer identity — #1580

Automatic profile linking requires an exact, unique Wikidata pair between the artist's existing Spotify ID and proposed Deezer ID. Names, follower counts and caller-supplied mapping confidence do not prove identity. Different display names are allowed when the exact pair is corroborated. Missing IDs, missing/ambiguous relationships and lookup failures leave the candidate for explicit confirmation. The lookup is bounded to four seconds and eleven rows; reaching the row cap abstains. This deliberately trades automatic coverage for avoiding wrong catalogs.

The automatic gate preserves any different Deezer link already present. The final write atomically checks that both catalog slots still match the verified snapshot; a concurrent edit causes rejection rather than an overwrite.

Explicit artist-confirmed link writes keep their existing authorization and collision checks. Existing connections and Latest snapshots are not rewritten. This prevents an automatic attachment class; it does not establish which path attached Rnd1's historical ID or correct production data. MCP writes are separate.

Tests use synthetic Wikidata responses, including the different-name alias case. They are not empirical proof of a real alias. No live provider calls are required for local verification. A deployed build would make the public Wikidata lookup only for automatic Deezer attachment. No paid provider or new configuration is used.

API documentation publication and exact-SHA preview checks remain pending. Verify 390x844 phone (2x/touch) and 832px desktop, light/dark: unresolved candidates are not connected, explicit confirmation succeeds, collisions remain rejected, and existing catalogs remain unchanged. No preview has been produced by this task.

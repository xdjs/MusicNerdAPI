# Artist Web Map query compatibility candidate

Local synthetic candidate only. No live grants or client deployment changed. The source contract is Grapevine commit `e95621f17fc2ed142a600031d7f6cf8a59a2b0b6`, recorded in `../../about-role-attribution-history.md`. Current credential-to-role mapping still needs confirmation. The full pinned shape is appropriate only for an explicitly audited existing full-row reader; its other fields have not been approved for new public exposure.

The consumer must change its read relation. Existing `SELECT * FROM artists` with the public search path deliberately fails after cutover: retaining it would expose raw About. Do not change the connection's whole search path, since writes must continue to target `public.artists` under its existing grants and RLS.

Minimal read rewrites:

```sql
-- server/musicnerd-service.ts:getArtistId and name lookup paths
SELECT * FROM mn_public.artists WHERE LOWER(name) = LOWER($1);
SELECT id FROM mn_public.artists WHERE LOWER(name) = LOWER($1);

-- api/network-by-id/[artistId].ts
SELECT id, name, webmapdata FROM mn_public.artists WHERE id = $1;

-- server/database-storage.ts:getArtistByName
SELECT id, name, spotify, node_pfp, webmapdata, x, instagram, facebook
FROM mn_public.artists WHERE LOWER(name) = LOWER($1);

-- api/network/[artistName].ts cache read: preserve response key only
SELECT node_pfp, spotify AS spotify_id FROM mn_public.artists WHERE id = $1;
```

The last query is a proposed explicit consumer correction, not a new database column. The pinned artist shape has `spotify`, not `spotify_id`. Confirm that the consumer expects that field's existing value semantics before deploying this alias; the unchanged `spotify_id` query fails with undefined-column error in the fixture.

Keep narrowly scoped writes on the base relation:

```sql
UPDATE public.artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2);
UPDATE public.artists SET webmapdata = $1 WHERE id = $2;
```

The prototype grants the audited map role only raw `SELECT(id,name,webmapdata)` for predicates and narrow results, retaining its existing `UPDATE(webmapdata)` grant and policies. It adds no UPDATE policy: the Dev replica remains a no-op; the production replica updates the matching row. `RETURNING *`, raw About/profile reads, other column updates and writes through the projection remain denied. Other profile reads use the guarded relation. Case-insensitive duplicate names retain existing SQL semantics; this candidate does not add uniqueness or choose a different artist.

`fullArtistShape.test.ts` tests these SQL statements with synthetic Dev/production policy replicas, visible About followed by source withdrawal, full column shape, missing `spotify_id`, the proposed alias, and negative access checks. PGlite checks SQL behavior, not actual Grapevine driver execution, deployed authentication, PostgreSQL 17, or network caching. The full-shape fixture retains unknown-role/drift abort tests. No raw client is silently remapped, no production role assignment is inferred, and source withdrawal cannot retroactively remove already downloaded client caches.

# Local compatibility proposal for #1580 / #1589

This uncommitted experiment overlays API70 schema508e361 on local85e4d61. It is not a merge of API70/74/82/84 routes or migrations, and does not activate the Web client.

## Writer contracts

Preserve upstream82 positions: `setArtistLink(id,site,value,selfEditUrl?,transaction?,evidence?)` and `writeArtistLinkColumn(tx,id,column,value,selfEditUrl?,evidence?)`. Automatic callers move their evidence to its explicit final argument. The existing conditional SQL and collisions remain mandatory even with a submitted URL. A self-edit is recorded only after a successful write and cancellation in the same transaction. A supplied transaction is reused, including artist locks and ownership checks.

Preserve upstream74 authorization position: `insertVaultSource(data,authorization?,provenance?)` and `writeVaultSource(tx,data,url,authorization?,provenance?)`. Upstream84 suggestion callers must pass `undefined, provenance`; they are not imported into this proposal. Provenance grants no upload/edit authorization. Differing actor IDs across authorization, operation and provenance throw before persistence. A context and explicit authorization must also agree on the expected claim ID, including null. Upload metadata and attribution are retained; research retains its receipt/origin and identity gate. Trusted suggestions reread the current role at write time, otherwise remain pending.

Imported helpers and contracts come from exact heads saved in `../evidence/compat-upstream/*-head.txt`. Only these writer slices are reconciled; upstream endpoint/auth contracts and migration constraints still need joined acceptance.

## Verification boundaries

Synthetic local tests use PGlite or mocks, no credentials or provider calls. Full repository tests/typecheck/lint/format are run against this local proposal. Fixture SQL is not the production migrations; browser acceptance, upstream routes, staging RLS and actual provider behavior are separate acceptance gates. #1580 historical provenance and existing-record cleanup are unchanged.

## Follow-up: pinned migration slice and one upstream handler

API70/74/82/84 heads were rechecked unchanged at508e361/f3e1bfa/f1e181e/c332e1f. The local Lore handler and validator are copied from API84 c332e1f; the handler insert call adds `undefined` before provenance. No app route is imported. Tests exercise that real handler through the real reconciled source writer; authentication, database transaction driver, queueing and extraction are mocked and external fetch forbidden. After importing its required URL-reader, UUID constant and exact API84 queue-attribution dependency, the unadapted call fails three behavioral assertions (500 instead of 201/409); the adjusted call passes. The initial import-only failure is not behavioral evidence. This closes the call-position regression, not Privy/database end-to-end acceptance.

The migration fixtures are exact copies with SHA256 checks and a pinned Web commit in their manifest. Eight tests execute the selected SQL in in-memory PGlite under mnweb/anon/authenticated roles. Bootstrap artists/users, uuid function and inherited base-table grants are explicitly synthetic. Tested: receipt SELECT/INSERT-only privileges and retention after job/source deletion; browser role denial; URL uniqueness/FKs; self-edit reassignment-only permission; account-transfer receipt identity; constrained queued extraction and uniqueness. This is a migration slice, not full replay or deployed policy verification. Web0000 is a commented baseline, and tracked creation/grant SQL for artist_id_mappings remains unavailable.

Remaining coordination: API82 manual/review routes and API74 actual upload routes must join these writer contracts on their owner's integration branch. Their auth/side-effects/storage are not imported here. API84 can apply the one-line provenance-slot change illustrated here. API70 has no migrations: staging must verify actual inherited grants, mapping policies and deployed schema. None of these require a parallel implementation in this worktree.

# Local compatibility proposal for #1580 / #1589

This uncommitted experiment overlays API70 schema508e361 on local85e4d61. It is not a merge of API70/74/82/84 routes or migrations, and does not activate the Web client.

## Writer contracts

Preserve upstream82 positions: `setArtistLink(id,site,value,selfEditUrl?,transaction?,evidence?)` and `writeArtistLinkColumn(tx,id,column,value,selfEditUrl?,evidence?)`. Automatic callers move their evidence to its explicit final argument. The existing conditional SQL and collisions remain mandatory even with a submitted URL. A self-edit is recorded only after a successful write and cancellation in the same transaction. A supplied transaction is reused, including artist locks and ownership checks.

Preserve upstream74 authorization position: `insertVaultSource(data,authorization?,provenance?)` and `writeVaultSource(tx,data,url,authorization?,provenance?)`. Upstream84 suggestion callers must pass `undefined, provenance`; they are not imported into this proposal. Provenance grants no upload/edit authorization. Differing actor IDs across authorization, operation and provenance throw before persistence. A context and explicit authorization must also agree on the expected claim ID, including null. Upload metadata and attribution are retained; research retains its receipt/origin and identity gate. Trusted suggestions reread the current role at write time, otherwise remain pending.

Imported helpers and contracts come from exact heads saved in `../evidence/compat-upstream/*-head.txt`. Only these writer slices are reconciled; upstream endpoint/auth contracts and migration constraints still need joined acceptance.

## Verification boundaries

Synthetic local tests use PGlite or mocks, no credentials or provider calls. Full repository tests/typecheck/lint/format are run against this local proposal. Fixture SQL is not the production migrations; browser acceptance, upstream routes, staging RLS and actual provider behavior are separate acceptance gates. #1580 historical provenance and existing-record cleanup are unchanged.

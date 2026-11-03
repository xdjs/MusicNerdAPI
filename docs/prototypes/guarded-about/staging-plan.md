# Guarded projection staging and rollout plan

Local planning only, 2026-11-03. No live writes, installs, deployments or credential changes are authorized by this document. The projection remains outside the app migration chain. See README for current prototype checks and limitations.

## Role attribution: confirmed versus unknown

Read-only catalog observation covered Music Nerd and Music Nerd Dev. Neither had active pg_stat_activity sessions, role-specific database settings, or membership records involving readonly_user/webmapdata_editor at that instant. Queries read no SQL statement bodies, credentials, client addresses or private records. No connection identity could be attributed. Absence of a role-attributed session is not inactivity history, and does not prove a role is unused. Pooled connections or sessions using SET ROLE may not appear under that role in the session-user field.

Confirmed earlier catalog facts: Dev readonly_user and webmapdata_editor are login roles with public-schema usage and artist SELECT; Dev's PUBLIC artist-read policy allows raw biography reads. Webmapdata_editor also has webmapdata UPDATE authority. Both projects have schema/creator-specific broad public defaults, requiring explicit ACL verification on new objects. Actual role grants—not names—determine access.

Tracked-file searches for the exact role names in Web found initial schema/policy definitions only. The same bounded searches in Docs, MusicNerdTV, mntv-artist-staging, musicnerd-agent and mnagentflow found no consumer references. Env/credential files were not opened; searches excluded env/lock/dependency files. A follow-up filename-only search of tracked JSON configuration (excluding schema snapshots/locks/dependencies) also found no role-name matches. This does not inspect external applications, secret-manager mappings, client traffic or historical sessions. The known TV source uses artist_cache; SleeveNote is documented as an HTTP client. Neither identifies these database-role owners.

Operator task before release: identify each role's responsible owner and actual query/write interface from existing account/secret-manager _labels_ or authorized client configuration, without exporting secret values. Validate consumers against staging. Decide whether to migrate, retire, or retain each role with a documented trusted scope. Do not guess that readonly_user is public or that webmapdata_editor needs biography text. Preserve intended map editing until explicitly migrated.

## PostgreSQL17 options without changing this machine

Current native binary and Homebrew inventory show PostgreSQL14.18 only. Docker CLI is installed but its daemon is unreachable; no image list or PG17 image was verified. No daemon start, image pull or installation was attempted. The previously observed remote targets are PostgreSQL17.6, but synthetic writes there are not authorized.

Practical choices for a separately authorized next phase:

1. An operator supplies an already installed PostgreSQL17 binary or pre-existing approved local container and an isolated empty database. Verify executable/image provenance and version before use; never attach an app volume or connection URL.
2. Use an existing approved CI runner with a pre-provisioned PostgreSQL17 service, no app secrets and synthetic fixtures. This needs an isolated execution setup; no new CI configuration/publication or image download occurred here.
3. An operator provisions a disposable PostgreSQL17 staging database in an approved environment, with synthetic data and explicitly scoped write authorization. Do not use the shared application database as an improvised test namespace.

If none is available, native17 verification stays blocked. PGlite reports PostgreSQL18 WASM and does not substitute for native17 role, concurrency or API-platform checks. The existing local native harness is guarded to a disposable TCP-disabled /tmp cluster; extend it to the projection and receipt cases before executing against17.

## Practical staged sequence

1. Freeze exact API/Web/SQL candidates and complete review. Finish atomic production writer integration for URL validation receipts using the existing JS validator; public reads must never write receipts. Record validator/runtime version and the receipt policy version. Validate byte identity, missing/version-mismatch refusal, source-change races and safe policy upgrades. Do not label a receipt as evidence approval: source moderation/trust/claim checks remain mandatory.
2. On an authorized synthetic PG17 instance, create target-equivalent roles, defaults, RLS and source column types. Run public/authenticated/custom-role and SET ROLE tests, rollback/failure injection, then two-session publication/source/claim/trust withdrawal races. Assert original text/history survives failures. Include receipt insertion and publication in one transaction; race changed URLs against generation.
3. Test real staging HTTP handlers against the projection adapter, then the actual PostgREST/GraphQL schema exposure and client queries. The current handler tests use a test-only adapter; they do not prove deployed wiring or metadata discovery. Verify all required public columns/order/types and embedded relationship contracts. Do not promote the prototype's three-field view as the full artist interface.
4. Migrate identified clients to the new interface in restricted staging. Test missing receipts and intentionally withdrawn sources without provider calls. Backfill only URL validation receipts from current bytes if approved; never invent legacy evidence provenance or change moderation. Invalid URLs remain unavailable. Confirm policy version transitions invalidate old receipts before accepting stricter semantics.
5. Rehearse cutover and rollback while public traffic, old deployments and workers are gated. Apply reviewed DDL in a bounded explicit transaction. Verify raw table denial for every untrusted/effective/assumable role, and preserve approved writer rights. New-schema grants and old-schema defaults both need verification. Abort on any unexpected reader, including readonly_user/webmapdata_editor until classified.
6. Only after explicit production approval, verified environment mapping and passing staging evidence, deploy the compatible pair and move approved clients. Close raw access in the controlled cutover. A dual-access migration window is still exposed; do not announce protection before raw paths close. Health checks alone are not generation or client verification. Resume workers only on compatible code.

## Failure, rollback and acceptance record

Before cutover, a failed transaction restores original behavior; keep traffic gated and report failure. After cutover, preserve private raw text, evidence and receipts, retain denied raw grants, and roll back to a compatible guarded interface. If no compatible reader exists, the rehearsed fail-closed fallback returns null bio while keeping artist identity available. Do not restore raw public reads or drop evidence for availability. Narrow URL-policy rollback also requires reviewed version semantics; never silently accept old receipts under a different validator.

The release record must contain exact SHAs, schema/receipt policy versions, engine version, approved role-owner matrix, grant/role test results, client contract evidence, concurrency results and compatible rollback artifacts. Store no credentials or raw private research in the record. Cleanup only explicitly created synthetic fixtures.

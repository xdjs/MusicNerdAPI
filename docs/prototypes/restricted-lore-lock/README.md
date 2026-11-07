# Restricted Lore event locking correction

Integrated locally into `lib/lore/assertLoreSourcesCurrent.ts`. Shared Dev remains unchanged.

The original assertion failed with PostgreSQL42501 because SELECT FOR SHARE requires UPDATE privilege and mnweb can only SELECT/INSERT activity events. The previous native fixture granted UPDATE on every table and missed that boundary.

The corrected assertion locks all current artist vault rows first, calls `mn_private.lock_lore_activity_events(uuid)`, then runs the existing eligibility and revision checks as the ordinary application role. Source-first locking fences activity_id relinking; the helper holds event row locks through the caller's transaction. Existing artist locks govern new-source insertion. This does not claim safety against privileged writers bypassing the artist-lock convention.

The proposed Web migration is `drizzle/0064_lore_activity_lock.sql`, mirrored in API checksum fixtures. It creates one void-returning SECURITY DEFINER function, with fixed pg_catalog search_path and fully qualified table names. It grants only EXECUTE to mnweb, revokes PUBLIC/anon/authenticated execution, and rejects unknown ACL entries or grant options. CREATE FUNCTION fails on name collisions. Apply as the controlled migration owner in a transaction. No event UPDATE/DELETE grant, new schema, data rewrite, trigger, credential, or public reader permission changes.

Validation:

- Actual assertion regression reproduced42501 before integration. -404 focused Lore/About tests pass; native-only file is separately exercised. -90 synthetic adapter/bootstrap tests pass. -32 native PostgreSQL17.11 tests pass, including both browser acceptance suites, actual About PUT/GET, missing/existing Lore, failure preservation, restricted event grants, and relinking to a second event followed by trust withdrawal.
- Independent mnweb process reads identical committed data after immediate restart. -9 standalone native checks cover ACL/default-grant failure, mutation denial, concurrent event/source changes, transaction rollback, and absent helper.
- Native fresh-schema bootstrap passes; updated older adapters include0064.
- TypeScript, changed-file ESLint and diff whitespace checks pass.

Independent exact-code review accepted locking order and least privilege. Its migration default-ACL and older-bootstrap findings were corrected and retested. No provider calls, hosted writes, deployments or paid retries during this work.

Rollout: apply0064 first, verify controlled owner/ACLs, then deploy paired candidate API preview (existing Web preview behavior unchanged) and repeat approved staging acceptance. The new persistent mnweb EXECUTE grant requires explicit Dev approval. Retain the helper while new API callers exist. Dropping it fails closed; returning to the old caller restores the known permission failure, not successful behavior.

Hosted two-regeneration acceptance remains unproven: the prior first action failed at persistence, its retry job is terminal, and the second action was not attempted. Exact prior provider attempt count/cost remains unavailable: the gateway metrics query requires paid Observability Plus; that feature was not enabled.

# #1655 current staging and cutover execution plan

Prepared 2026-11-04. This replaces obsolete candidate hashes and pending-writer tasks in earlier proposals. It is an execution plan, not permission to mutate a hosted environment. No model calls are needed for the mandatory run.

## Frozen application scope

- API application: `ecc6e405712b6af3496574518551e9390abc2071`.
- Web application and migrations: `d219118f1e3b9a0fa5c3807a8bf3ea4414fad99f`.
- API validation-runner/docs follow-up: record its final commit with the execution result; it does not change the application.
- Migration fixtures0060–0063 and SHA256 checks: `docs/prototypes/pg17-ci/migration-fixtures.json`. The guarded full-row projection remains a reviewed prototype outside the migration journal. It cannot become an executable target migration until actual reader mappings and schema/audience checks are resolved.

## First: local engine evidence

Use a provenance-checked PostgreSQL17 runtime with the guarded runner:

```sh
PG17_BIN=/absolute/path/to/verified/postgresql17/bin \
NODE24_BIN=/absolute/path/to/node24 \
MN_APPROVED_SYNTHETIC_PG17=yes \
bash docs/prototypes/pg17-ci/run-native-pg17.sh
```

The runner verifies versions and fixture hashes, creates its own private temporary directory, disables TCP, checks database identity, runs the native suite and stops/removes only its own cluster. Never supply a hosted URL or reuse an application database. Record the server patch version, build options and platform; major-version success does not prove Supabase extensions, Data API metadata, network/cache behavior or an identical target patch version.

## Second: isolated staging, zero providers

Before any hosted write, an operator must supply the exact disposable environment/database and preview IDs, owner, expiration and infrastructure budget. Use synthetic data and isolated authentication, no copied customer rows or production credentials. Disable workers, schedules, webhooks and external egress. The deterministic model substitutions must exist only in the test runtime, with no production-accessible request switch. Existing local test mocks are not deployed mock-provider wiring; a hosted adapter must be prepared and reviewed before execution.

1. Record the baseline schema/ledger and target engine version. Apply the pinned baseline and migrations0060–0063 in order to the dedicated empty database. Verify private schema grants, trigger ownership/search paths, PUBLIC execution denial, and expected app writes. Refuse unexpected defaults or role inheritance.
2. Restore one synthetic artist fixture between serial cases. Use separate roles for claimant, outsider, trusted contributor and admin. Keep the same source/text/claim hashes in the test manifest. Use a synthetic exact-snapshot permission; never upload the private production16 manifest to staging.
3. Exercise the real API and Web control for the matrix below. Record HTTP response/status, UI state, per-stage stub call counts, before/after database values and request IDs. Assert no external network attempts or unmatched writes. Repeated/no-op requests must not create duplicate jobs/history.

| Case | Required result |
| --- | --- |
| Approved readable Lore, no document | Regenerate About prepares Lore then About; one successful response only after both persist |
| Current existing document | About uses it; no duplicate preparation |
| New eligible Lore / stale document | Required update precedes About; withdrawn/private/rejected sources never publish |
| No usable Lore | Clear error, zero model calls and no content replacement |
| Preparation failure | Preparation-specific error; old bio/pin retained; lease settled or recoverable |
| About failure after preparation | About-specific error, no success claim; previous bio retained |
| Two clicks / in-flight job | Single admitted generation; second receives useful busy response |
| Source or claim changes during generation | Stale result cannot commit; exact prior text/history retained |
| Unfinished claimant setup | Starts/resumes after authentication; keeps existing About, pin and nonempty Lore; fills missing material |
| Existing pending/trusted contribution | Setup does not bulk approve, reclassify or overwrite it |
| Legacy exact snapshot | Original text visible only for matching approved claim/hash with no provenance row |
| Legacy changed/revoked/withdrawn | Permission consumed; restoring text or claim alone does not revive it |
| Anonymous/outsider/trusted contributor | No newly granted profile-edit or regeneration authority |
| Public reads and cached drafts | Source withdrawal reflected in API/UI/metadata; stale draft cannot republish |
| Deadline/settlement recovery | Inject timeout/finalization failure, drain work, retry using actual recovery path; no stale commit or manual lease rewrite disguised as recovery |

4. Test the actual hosted Data API/GraphQL and known external client contracts, including qualified relation, select-star shape, schema discovery/embeddings, SET ROLE, cache behavior and narrow map UPDATE/RETURNING. Synthetic SQL alone cannot prove these interfaces. The two unidentified raw readers remain a stop condition.
5. Rehearse the reviewed target-specific projection migration and compatible rollback on the disposable database. Test denied raw bio/evidence reads, intended full-row view audience, Dev no-op map writes versus production permitted narrow writes, and inheritance/function/view escape checks. Restore only synthetic baselines between cases.
6. Retain sanitized results, stop/drain jobs, then destroy only the manifested disposable environment/identities after retention approval. Never use wildcard cleanup against a shared database or bucket.

## Third: coordinated cutover

The concrete permission matrix and executable projection migration require identified consumers. Ask the provisioning owner for the application label, accountable owner and query/write contract of `webmapdata_editor` and Dev `readonly_user`; no credential values are needed. Carl is a historical routing lead, not a proven owner. Missing logs or sessions do not establish disuse.

After staging acceptance and specific release authorization:

1. Pin API/Web/migration artifacts and a compatible rollback pair. Verify backup/restore, gate affected traffic and old deployments, stop scheduled/background producers, and drain generation. Apply required sidecars before new readers can serve requests.
2. Re-run target catalog/preflight: exact 65-column signature, grants/default ACLs/RLS, inherited and SET ROLE access, forwarding views/RPCs, approved audiences and actual client mappings. Unknown raw readers abort the transaction; do not widen an allowlist to pass.
3. Begin one approved transaction covering both exact16 activation and the projection/grant cutover in steps3–4. Under bounded lock/statement timeouts, lock affected artists in deterministic order and validate the private16 manifest checksum/count/uniqueness plus exact approved claim, biography hash, pin, source checkpoint and absence of provenance. Any drift stops for review. Seed only the reviewed explicit entries once; never auto-update hashes or infer historical lineage.
4. In that same transaction, apply the reviewed guarded projection/client-grant cutover with postflight assertions; commit only after every assertion passes. A failure rolls back the seed and grant changes together. Preserve approved map write semantics. Failure rolls back; it does not authorize a less restrictive retry.
5. Start the pinned compatible API/Web pair behind the still-closed traffic gate, with producers disabled. Verify all16 unchanged bios through real guarded readers; verify new generated text receipts/withdrawal and intended row/field audiences. Check actual API/UI metadata and client queries. Do not open the new readers with an empty exception table.
6. Verify the changed workflow through the gated pair, resume only compatible workers, then open traffic after owner acceptance. Record release evidence separately from local/CI success.

Before commit, failed cutover rolls back and traffic stays gated as appropriate. After commit, keep raw denial, private history and consumed-exception state; restore only a compatible guarded application pair or roll forward. Never restore old permissions, source approvals or raw SELECT access to recover availability. If necessary, use the reviewed null-bio fallback while preserving artist identity and authorized editor access.

## Smallest outstanding authorizations

Local synthetic checks require no live permission change. The next hosted step needs a named disposable staging target and permission to deploy only the pinned test pair/schema there with synthetic writes, isolated auth, zero provider calls and an infrastructure budget. Production activation/grant changes are a later separate approval. Consumer identification is a factual dependency, not a request to assume roles are unused.

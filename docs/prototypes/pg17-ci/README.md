# Native PostgreSQL 17 validation and disabled CI proposal

Nothing in this directory activates a workflow. `native-pg17.yml.disabled` is outside `.github/workflows` and its only job has an unconditional false guard. The server script also requires an explicit approval flag. The runner was executed locally on 2026-11-04 using a checksum-verified official PostgreSQL17.11 source build under `/tmp`: all24 tests passed. No system installation, container or hosted CI dispatch occurred. See [the execution record](../../about-pg17-verification.md).

## Current feasibility

This is **not runnable on the default GitHub-hosted Ubuntu image as written**. The parent independently checked the official runner inventory and found PostgreSQL 16.15 on Ubuntu 24 and 18.6 on Ubuntu 26, rather than 17. Consult the [official runner-image inventory](https://github.com/actions/runner-images) and [Ubuntu 24 installed software list](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) when selecting an approved runner. Availability changes; the script checks the actual executable versions rather than trusting a label.

The disabled workflow is a proposed entry point, not a complete provisioning pipeline. An operator must provide an explicitly approved Linux runner/image containing PostgreSQL 17, Node 24, this exact checkout and its lockfile-matching dependencies. The default hosted image does not establish those prerequisites. Provisioning, image selection, checkout/artifact transfer, activation and dispatch require separate review and approval. No setup action, package install, container pull or network fallback is included. A separate official-container draft below now specifies container user/Node provisioning; it remains unexecuted and independently requires approval. A TCP service container is not an acceptable substitute for the socket-only harness.

## Required inputs and safety checks

- Non-root Linux or Darwin OS account. Darwin requires an explicit `PG17_BIN`. PostgreSQL admin role is that same OS account, matching `userInfo().username` in the harness.
- `PG17_BIN`: absolute directory containing preinstalled `postgres`, `initdb`, `pg_ctl`, `psql` and `createdb`. Every executable must report major version 17; otherwise stop.
- `NODE24_BIN`: absolute preinstalled Node 24 executable, or a Node 24 already on PATH. There is no automatic installation.
- Existing repository-local `node_modules` matching the reviewed lockfile. The script refuses to install dependencies. The native suite imports the application modules through its existing local database replacement and never needs application credentials or a model provider.
- `MN_APPROVED_SYNTHETIC_PG17=yes` only after approval. A caller-supplied `MN_1655_PG_SOCKET` is rejected; the script creates its own directory.

The script makes a private `/tmp/mn-1655-pg.XXXXXXXX` directory, initializes its `data` subdirectory, disables TCP with empty `listen_addresses`, sets Unix socket mode 0700 and uses fixed port 55465 only within that unique socket directory. Host authentication rejects connections. PostgreSQL service/password environment overrides are removed, and password/service files point into the disposable directory. The only database is `mn_1655_synthetic`, marked `mn-1655-synthetic-only`. The script verifies database name, marker, empty TCP listener and exact data path before invoking tests.

The harness independently retains its original socket regexp, marker/database checks and canonical `realpath` comparison of `data_directory` to the socket directory's `data` subdirectory. No checks were relaxed for Linux. Traps stop only this invocation's cluster, then remove only its mktemp directory. A shutdown failure retains the directory and fails rather than deleting active server files.

## Portable migration fixtures

`migration-fixtures.json` records source repository, source commit/path and SHA-256 for exact migration 0060, 0061, 0062 and 0063 bytes. The first two are copied into `fixtures/`; 0062/0063 reuse the guarded-about test fixtures. `verify-fixtures.mjs` checks them without starting a server. The native harness verifies each checksum again before applying it. These copies are test fixtures, not a second active migration journal.

Both native migration reads are now repository-relative. No default or opt-in test requires `/tmp/mn-about-trusted-web`. The 24-case native suite still runs only with its explicit guarded socket variable. PGlite, native PG14 results and a static script review do not establish PG17 execution. Full production schemas, consumer attribution, hosted API behavior, real providers and release authorization remain outside this harness.

Static checks performed here: `bash -n run-native-pg17.sh`, Node syntax checking, exact migration hash comparisons and the default opt-out native test path. The next step is approval of a concrete preprovisioned runner/image and its provisioning/checkout contract, then an approved manual run. Do not simply enable the disabled job on a standard hosted image and report missing prerequisites as a completed PG17 verification.

## Explicit official-container alternative (prepared, not executed)

`official-container-pg17.yml.disabled` supplies the previously missing bootstrap as an alternative draft. It uses the Docker Official Image `postgres:17-bookworm` as the job container, official GitHub checkout/Node setup, the repository's existing pnpm setup action and lockfile, then runs the native script as the container's unprivileged postgres user through its bundled gosu. The [official image Dockerfile](https://github.com/docker-library/postgres/blob/master/17/bookworm/Dockerfile) establishes the postgres user, gosu and `/usr/lib/postgresql/17/bin` layout. Exact image digest/action SHAs must be reviewed and pinned before publication; the draft tags are not an immutable execution approval.

The bootstrap would download the image, Node/actions and locked dependencies **only in a separately approved future run**. Package lifecycle scripts are disabled. No model keys, database secrets, OIDC grant, environment connection or deployment step is provided; checkout credentials are not persisted. The test process receives a cleared environment with only executable paths and the synthetic approval flag, uses no TCP service, and creates its own marked cluster. Workspace ownership changes are confined to the ephemeral `/__w/` checkout so the non-root test process can write its cache. This is not a command for the Mac or an existing application checkout.

Neither draft is activated, published or dispatched. Container startup/checkout behavior, Node/pnpm tool permissions, `--ignore-scripts` dependency compatibility remain unverified until that hosted run; local PG17 success does not verify the container bootstrap. If any prerequisite fails, stop and adjust the reviewed draft; do not substitute TCP or relax the destructive-database guards. No claim of zero infrastructure cost or existing organization runner entitlement is made. This alternative removes the need for an unidentified preprovisioned runner, but still requires approval of the concrete image/action pins and the hosted run.

Portable-harness follow-up:19 native PostgreSQL14.18 tests passed in4.11s after the fixture changes, using the pre-existing guarded temporary socket cluster; that cluster is stopped. This verifies portability changes on14 only, not the new LinuxPG17 bootstrap or hosted workflow.

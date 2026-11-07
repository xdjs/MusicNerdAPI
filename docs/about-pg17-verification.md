# Native PostgreSQL17 verification — 2026-11-04

**24/24 native migration, policy, concurrency and publication tests passed on PostgreSQL17.11 in4.20 seconds.** The guarded runner reported `server_version_num=170011`, verified no TCP listener and exact disposable database identity, then stopped the server. The single temporary cluster directory found in its log was verified removed; exit status0.

Application candidate: API `ecc6e405712b6af3496574518551e9390abc2071`, Web/migrations `d219118f1e3b9a0fa5c3807a8bf3ea4414fad99f`. This follow-up changes only the validation runner and documentation, not application behavior.

## Runtime provenance and build

Docker was unavailable and the installed native runtime was PostgreSQL14.18. The authorized local test instead built the [official PostgreSQL17.11 source archive](https://www.postgresql.org/ftp/source/v17.11/) using the existing Apple compiler and make, following [PostgreSQL's source-build procedure](https://www.postgresql.org/docs/17/install-make.html). Download used HTTPS and the archive matched the accompanying official SHA256:

```text
postgresql-17.11.tar.bz2
dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979
```

Source, build logs and runtime are under `/tmp/mn-pg17-build`. No package manager, system installation, launch service, shell-profile change or hosted infrastructure was used. Configure options were `--prefix=/tmp/mn-pg17-build/runtime --without-icu --without-readline --without-zlib`; build used `make -j4` and installed only to that temporary prefix. These optional-feature omissions are acceptable for the exercised SQL/transaction tests but do not establish production locale, compression, TLS or extension parity. The local patch17.11 is not the previously observed hosted patch17.6.

## Exact execution

```sh
env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin \
PG17_BIN=/tmp/mn-pg17-build/runtime/bin \
NODE24_BIN=/absolute/path/to/node24 \
MN_APPROVED_SYNTHETIC_PG17=yes \
/bin/bash docs/prototypes/pg17-ci/run-native-pg17.sh
```

The actual run used the existing Node24.16.0 executable. Log: `/tmp/mn-pg17-build/native-tests.log`. No application credentials or inherited connection settings were passed. The runner verified all four repository-local migration fixture checksums before initializing the cluster. It tests the existing24-case `lib/bio/__tests__/aboutConcurrency.postgres.test.ts` unchanged, including source/claim races, real lock timeout, transactional publication/receipt rollback, exact legacy permissions and setup/source-approval concurrency.

Darwin support only adds explicit-platform/runtime selection, canonical path comparison for `/tmp`→`/private/tmp`, and an independent running-server major-version check. Root, supplied sockets, wrong executable versions, unexpected database/marker/data path and active-server cleanup remain refused. Additional local refusal checks confirmed missing approval, caller-supplied sockets and PostgreSQL14 executables fail before cluster initialization; shell syntax, all four fixture hashes and changed-document formatting also passed.

## Limits and next step

This clears the native-major-version execution gate. It does not test hosted Supabase extensions, PostgREST/GraphQL metadata, actual external clients, deployed UI/auth/cache behavior or a paid provider. The disabled hosted CI files remain unpublished and unexecuted. No shared or live database, grants, production snapshots or provider was touched.

Use [the current staging/cutover plan](about-staging-cutover-current.md). Unknown raw-role consumers must be identified before grant cutover; absent telemetry is not proof of disuse. Exact16 activation and production rollout remain separate authorized operations.

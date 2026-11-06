#!/usr/bin/env bash
# Isolated native PG17 validation; run only within the authorized synthetic test scope.
# Uses preinstalled binaries/dependencies; no install, download, Docker, credentials or TCP.
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "${MN_APPROVED_SYNTHETIC_PG17:-}" == "yes" ]] || fail 'Explicit synthetic PG17 approval flag required'
case "$(uname -s)" in
  Linux) ;;
  Darwin) [[ -n "${PG17_BIN:-}" ]] || fail 'Darwin requires explicit PG17_BIN' ;;
  *) fail 'Only Linux and Darwin are supported' ;;
esac
[[ "$(id -u)" != "0" ]] || fail 'Refusing root-run PostgreSQL'
[[ -z "${MN_1655_PG_SOCKET:-}" ]] || fail 'Refusing supplied socket; script creates its own isolated directory'
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_dir=$(cd -- "$script_dir/../../.." && pwd -P)
pg17_bin=${PG17_BIN:-/usr/lib/postgresql/17/bin}
node24_bin=${NODE24_BIN:-$(command -v node || true)}
[[ "$pg17_bin" == /* && "$node24_bin" == /* ]] || fail 'Absolute preinstalled binary paths required'
for program in postgres initdb pg_ctl psql createdb; do
  [[ -x "$pg17_bin/$program" ]] || fail "Missing preinstalled PostgreSQL executable: $program"
  "$pg17_bin/$program" --version | grep -Eq 'PostgreSQL\) 17([.]|$)' || fail 'Every PostgreSQL executable must be version 17'
done
[[ -x "$node24_bin" ]] || fail 'Preinstalled Node24 executable required'
[[ "$("$node24_bin" -p 'process.versions.node.split(".")[0]')" == "24" ]] || fail 'Node24 required'
[[ -f "$repo_dir/node_modules/vitest/vitest.mjs" ]] || fail 'Preprovisioned lockfile-matching dependencies required; this script never installs'
"$node24_bin" "$script_dir/verify-fixtures.mjs"

# Do not inherit PostgreSQL service/password connection settings from the runner.
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS PGSSLMODE PGREQUIRESSL
run_dir=$(mktemp -d /tmp/mn-1655-pg.XXXXXXXX)
[[ "$run_dir" =~ ^/tmp/mn-1655-pg\.[A-Za-z0-9]+$ ]] || fail 'Unexpected temporary directory'
cluster_owned=no
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if [[ "$cluster_owned" == yes && -f "$run_dir/data/postmaster.pid" ]]; then
    if ! "$pg17_bin/pg_ctl" -D "$run_dir/data" -m immediate -w stop; then
      printf '%s\n' "Could not stop isolated cluster; retained directory: $run_dir" >&2
      exit 1
    fi
  fi
  if [[ "$result" != 0 && -f "$run_dir/server.log" ]]; then
    # Synthetic-only cluster diagnostics; never reads a shared server log.
    tail -n 80 "$run_dir/server.log" >&2
  fi
  # Only remove the exact mktemp directory created by this invocation, after shutdown.
  rm -rf -- "$run_dir"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export PGPASSFILE="$run_dir/no-password-file"
export PGSYSCONFDIR="$run_dir"
"$pg17_bin/initdb" -D "$run_dir/data" --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8
cluster_owned=yes
# Restrictive socket permissions plus empty listen_addresses prevent external access.
"$pg17_bin/pg_ctl" -D "$run_dir/data" -l "$run_dir/server.log" -o "-c listen_addresses='' -c unix_socket_directories='$run_dir' -c unix_socket_permissions=0700 -p 55465" -w start
admin_user=$(id -un)
"$pg17_bin/createdb" --host="$run_dir" --port=55465 --username="$admin_user" mn_1655_synthetic
"$pg17_bin/psql" -X --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 <<'SQL'
COMMENT ON DATABASE mn_1655_synthetic IS 'mn-1655-synthetic-only';
CREATE ROLE mnweb LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
SQL
server_version=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "show server_version_num")
[[ "$server_version" =~ ^17[0-9]{4}$ ]] || fail 'Running server must be PostgreSQL 17'
canonical_data=$("$node24_bin" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$run_dir/data")
identity=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "select current_database() || '|' || current_setting('listen_addresses') || '|' || shobj_description(oid,'pg_database') from pg_database where datname=current_database()")
[[ "$identity" == "mn_1655_synthetic||mn-1655-synthetic-only" ]] || fail 'Disposable cluster identity mismatch'
actual_data=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "show data_directory")
actual_data=$("$node24_bin" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$actual_data")
[[ "$actual_data" == "$canonical_data" ]] || fail 'Disposable cluster data directory mismatch'
printf 'Validated PostgreSQL server_version_num=%s; TCP disabled; isolated cluster identity verified\n' "$server_version"
cd -- "$repo_dir"
vitest_args=(run lib/bio/__tests__/aboutConcurrency.postgres.test.ts)
if [[ -n "${MN_1655_NATIVE_PATTERN:-}" ]]; then vitest_args+=(-t "$MN_1655_NATIVE_PATTERN"); fi
MN_1655_PG_SOCKET="$run_dir" "$node24_bin" node_modules/vitest/vitest.mjs "${vitest_args[@]}"

MN_APPROVED_SYNTHETIC_PG17=yes MN_1655_PG_SOCKET="$run_dir" "$node24_bin" docs/prototypes/pg17-ci/bootstrap-role-rehearsal.mjs

# Seed via real route handlers, leaving their committed result for an independent process.
MN_1655_PG_SOCKET="$run_dir" "$node24_bin" node_modules/vitest/vitest.mjs run lib/bio/__tests__/aboutConcurrency.postgres.test.ts -t 'persists actual independent route requests'
snapshot() {
  "$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username=mnweb --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 <<'SQL'
select jsonb_build_object(
  'artists',(select jsonb_agg(to_jsonb(t) order by id) from artists t),
  'docs',(select jsonb_agg(to_jsonb(t) order by id) from artist_docs t),
  'history',(select jsonb_agg(to_jsonb(t) order by id) from artist_bio_versions t),
  'provenance',(select jsonb_agg(to_jsonb(t) order by artist_id) from mn_private.artist_bio_provenance t),
  'history_provenance',(select jsonb_agg(to_jsonb(t) order by version_id) from mn_private.artist_bio_version_provenance t),
  'receipts',(select jsonb_agg(to_jsonb(t) order by url) from mn_private.public_url_receipts t),
  'sources',(select jsonb_agg(to_jsonb(t) order by id) from artist_vault_sources t),
  'jobs',(select jsonb_agg(to_jsonb(t) order by id) from artist_research_jobs t)
);
SQL
}
before_restart=$(snapshot)
[[ "$before_restart" == *'Synthetic About'* ]] || fail 'Route fixture was not committed'
# Immediate stop exercises WAL recovery, not just a clean checkpoint. No requests are active.
"$pg17_bin/pg_ctl" -D "$run_dir/data" -m immediate -w stop
"$pg17_bin/pg_ctl" -D "$run_dir/data" -l "$run_dir/server.log" -o "-c listen_addresses='' -c unix_socket_directories='$run_dir' -c unix_socket_permissions=0700 -p 55465" -w start
restart_identity=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "select current_database() || '|' || current_setting('listen_addresses') || '|' || current_setting('server_version_num') from pg_database where datname=current_database()")
[[ "$restart_identity" == "mn_1655_synthetic||$server_version" ]] || fail 'Restart target identity changed'
restart_data=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "show data_directory")
restart_data=$("$node24_bin" -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$restart_data")
[[ "$restart_data" == "$canonical_data" ]] || fail 'Restart data directory changed'
after_restart=$(snapshot)
[[ "$before_restart" == "$after_restart" ]] || fail 'Committed fixture changed across restart'
printf '%s\n' 'PASS: independent mnweb process read identical About, Lore, history, evidence, sources and jobs after immediate PostgreSQL restart'

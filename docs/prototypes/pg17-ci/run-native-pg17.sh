#!/usr/bin/env bash
# DISABLED PROPOSAL SUPPORT: run only after explicit approval on the designated CI runner.
# Uses preinstalled binaries/dependencies; no install, download, Docker, credentials or TCP.
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "${MN_APPROVED_SYNTHETIC_PG17:-}" == "yes" ]] || fail 'Explicit synthetic PG17 approval flag required'
[[ "$(uname -s)" == "Linux" ]] || fail 'This proposal requires Linux'
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
identity=$("$pg17_bin/psql" -XAt --no-password --host="$run_dir" --port=55465 --username="$admin_user" --dbname=mn_1655_synthetic --set=ON_ERROR_STOP=1 -c "select current_database() || '|' || current_setting('listen_addresses') || '|' || current_setting('data_directory') || '|' || shobj_description(oid,'pg_database') from pg_database where datname=current_database()")
[[ "$identity" == "mn_1655_synthetic||$run_dir/data|mn-1655-synthetic-only" ]] || fail 'Disposable cluster identity mismatch'
cd -- "$repo_dir"
MN_1655_PG_SOCKET="$run_dir" "$node24_bin" node_modules/vitest/vitest.mjs run lib/bio/__tests__/aboutConcurrency.postgres.test.ts

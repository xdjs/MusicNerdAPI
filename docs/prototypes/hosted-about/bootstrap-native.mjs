/** Disposable local-only PG17 validation. No URL/env-file input or remote connection. */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { cleanupOwnedBootstrap } from "./bootstrap-cleanup.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const bin = "/tmp/mn-pg17-build/runtime/bin";
assert(process.getuid() !== 0, "Do not run as root");
const root = mkdtempSync("/tmp/mn-about-bootstrap-");
const data = join(root, "data"),
  socket = join(root, "socket");
mkdirSync(socket, { mode: 0o700 });
const marker = `${process.pid}:${root}`;
writeFileSync(join(root, "owner-marker"), marker, { mode: 0o600 });
const env = { PATH: bin + ":/usr/bin:/bin", LANG: "C", LC_ALL: "C", TMPDIR: root };
const run = (name, args, input) => {
  const r = spawnSync(join(bin, name), args, {
    env,
    input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`${name} failed: ${r.stderr}\n${r.stdout}`);
  return r.stdout;
};
const db = "mn_about_synthetic";
const args = ["-X", "-v", "ON_ERROR_STOP=1", "-h", socket, "-p", "6546", "-U", "bootstrap_owner"];
let attemptedStart = false;
try {
  assert.match(run("postgres", ["--version"]), /PostgreSQL\) 17\./);
  assert(
    existsSync(join(bin, "../share/postgresql/extension/pg_trgm.control")),
    "Install official pg_trgm into the /tmp runtime first",
  );
  run("initdb", [
    "-D",
    data,
    "-U",
    "bootstrap_owner",
    "--auth-local=trust",
    "--auth-host=reject",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  attemptedStart = true;
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "server.log"),
    "-o",
    `-c listen_addresses='' -c unix_socket_directories=${socket} -c unix_socket_permissions=0700 -p 6546`,
    "-w",
    "start",
  ]);
  const identity = run("psql", [
    ...args,
    "-d",
    "postgres",
    "-At",
    "-c",
    "select current_setting('data_directory')||'|'||current_setting('listen_addresses')||'|'||current_user",
  ]);
  const [observedData, listen, owner] = identity.trim().split("|");
  assert.equal(realpathSync(observedData), realpathSync(data));
  assert.equal(listen, "");
  assert.equal(owner, "bootstrap_owner");
  run("psql", [...args, "-d", "postgres", "-c", `CREATE DATABASE ${db}`]);
  run("psql", [
    ...args,
    "-d",
    db,
    "-c",
    "CREATE ROLE mnweb;CREATE ROLE mn_bot;CREATE ROLE webmapdata_editor;CREATE ROLE anon;CREATE ROLE authenticated",
  ]);
  for (const file of [
    "fresh-schema.bootstrap.sql",
    "bootstrap-functions.sql",
    "bootstrap-reset-access.sql",
    "bootstrap-access.sql",
    "bootstrap-audit.sql",
    "bootstrap-verify.sql",
  ])
    run("psql", [...args, "-d", db, "-f", join(here, file)]);
  console.log(
    JSON.stringify({
      ok: true,
      database: db,
      root,
      network: "unix-only",
      validation: "bootstrap-verify.sql",
    }),
  );
} finally {
  const cleanup = cleanupOwnedBootstrap({
    root,
    data,
    marker,
    attemptedStart,
    pgCtl: args => spawnSync(join(bin, "pg_ctl"), args, { env, encoding: "utf8" }),
  });
  console.log(JSON.stringify({ cleanup: cleanup.state, root, filesRetained: true }));
}

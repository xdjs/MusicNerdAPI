/** Local-only PG17 role/bootstrap rehearsal. Never uses a URL, password, or hosted credentials. */
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const names = Object.freeze({
  operator: "mn1655_rehearsal_operator",
  owner: "mn1655_rehearsal_owner",
  app: "mn1655_rehearsal_app",
  database: "mn1655_rehearsal_db",
  sharedSchema: "mn1655_rehearsal_shared",
});
export function validateSocket(socket) {
  assert.match(socket ?? "", /^\/tmp\/mn-1655-pg\.[A-Za-z0-9]+$/, "Owned test socket required");
  return socket;
}

/** Requires the existing runner's owned, marked, socket-only PG17 cluster. Cleans only its own objects. */
export async function rehearseBootstrapRoles(socket) {
  validateSocket(socket);
  const options = {
    host: socket,
    port: 55465,
    database: "mn_1655_synthetic",
    prepare: false,
    max: 1,
    connect_timeout: 3,
    connection: { statement_timeout: 6000, application_name: "mn1655-role-rehearsal" },
  };
  const connections = [];
  const open = (user, database = options.database) => {
    const connection = postgres({ ...options, user, database });
    connections.push(connection);
    return connection;
  };
  const admin = open(userInfo().username);
  const createdRoles = new Map();
  let databaseOid, sharedSchemaOid;
  try {
    const [identity] =
      await admin`select current_database() as db, current_setting('data_directory') as dir,
      current_setting('listen_addresses') as addresses, current_setting('server_version_num') as version,
      shobj_description(oid,'pg_database') as marker from pg_database where datname=current_database()`;
    assert.equal(identity.db, "mn_1655_synthetic");
    assert.equal(identity.marker, "mn-1655-synthetic-only");
    assert.equal(identity.addresses, "");
    assert.match(identity.version, /^17[0-9]{4}$/);
    assert.equal(realpathSync(identity.dir), realpathSync(`${socket}/data`));
    assert.equal(
      (
        await admin`select oid from pg_roles where rolname in (${names.operator},${names.owner},${names.app})`
      ).length,
      0,
      "Role collision",
    );
    assert.equal(
      (await admin`select oid from pg_database where datname=${names.database}`).length,
      0,
      "Database collision",
    );
    assert.equal(
      (await admin`select oid from pg_namespace where nspname=${names.sharedSchema}`).length,
      0,
      "Schema collision",
    );
    const remember = async role => {
      const [row] = await admin`select oid from pg_roles where rolname=${role}`;
      createdRoles.set(role, row.oid);
    };
    await admin.unsafe(
      "CREATE ROLE mn1655_rehearsal_operator LOGIN NOSUPERUSER NOBYPASSRLS CREATEDB CREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 2",
    );
    await remember(names.operator);
    // Emulate existing shared-data access without reading or changing any actual application relation.
    await admin.unsafe(
      "CREATE SCHEMA mn1655_rehearsal_shared; GRANT USAGE ON SCHEMA mn1655_rehearsal_shared TO PUBLIC; CREATE TABLE mn1655_rehearsal_shared.secret(id int); INSERT INTO mn1655_rehearsal_shared.secret VALUES(1); REVOKE ALL ON mn1655_rehearsal_shared.secret FROM PUBLIC",
    );
    sharedSchemaOid = (
      await admin`select oid from pg_namespace where nspname=${names.sharedSchema}`
    )[0].oid;
    const operator = open(names.operator);
    const [operatorIdentity] =
      await operator`select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user`;
    assert.deepEqual(operatorIdentity, {
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: true,
      rolcreaterole: true,
    });
    await operator.unsafe(
      "CREATE ROLE mn1655_rehearsal_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT",
    );
    await remember(names.owner);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await operator.unsafe(
      `CREATE ROLE mn1655_rehearsal_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 2 VALID UNTIL '${expiresAt}'`,
    );
    await remember(names.app);
    // Local trust authentication uses no password. VALID UNTIL does not constrain trust sessions.
    await operator.unsafe(
      "GRANT mn1655_rehearsal_owner TO mn1655_rehearsal_operator WITH INHERIT FALSE, SET TRUE",
    );
    // Must be a standalone driver statement, never begin()/migration SQL. This does not verify Management API behavior.
    await operator.unsafe(
      "CREATE DATABASE mn1655_rehearsal_db WITH OWNER mn1655_rehearsal_owner TEMPLATE template0",
    );
    databaseOid = (await admin`select oid from pg_database where datname=${names.database}`)[0].oid;
    await operator.unsafe(
      "SET ROLE mn1655_rehearsal_owner; REVOKE CONNECT,TEMPORARY ON DATABASE mn1655_rehearsal_db FROM PUBLIC; GRANT CONNECT ON DATABASE mn1655_rehearsal_db TO mn1655_rehearsal_app; RESET ROLE",
    );
    await operator.unsafe(
      "GRANT mn1655_rehearsal_owner TO mn1655_rehearsal_app WITH ADMIN FALSE, INHERIT FALSE, SET TRUE",
    );
    const bootstrap = open(names.app, names.database);
    await bootstrap.unsafe("SET ROLE mn1655_rehearsal_owner");
    assert.equal((await bootstrap`select current_user as role`)[0].role, names.owner);
    await bootstrap.unsafe(`
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      CREATE SCHEMA mn_private;
      REVOKE ALL ON SCHEMA mn_private FROM PUBLIC;
      CREATE TABLE public.artists(id int PRIMARY KEY, bio text, private_note text);
      CREATE TABLE public.users(id int PRIMARY KEY);
      CREATE TABLE mn_private.public_url_receipts(url text PRIMARY KEY);
      ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      INSERT INTO public.artists VALUES(1,'Original','private');
      INSERT INTO public.users VALUES(1);
      GRANT USAGE ON SCHEMA public,mn_private TO mn1655_rehearsal_app;
      GRANT SELECT ON public.artists,public.users TO mn1655_rehearsal_app;
      GRANT UPDATE(bio) ON public.artists TO mn1655_rehearsal_app;
      GRANT UPDATE(id) ON public.users TO mn1655_rehearsal_app;
      GRANT SELECT,INSERT ON mn_private.public_url_receipts TO mn1655_rehearsal_app;
      CREATE POLICY app_read ON public.artists FOR SELECT TO mn1655_rehearsal_app USING(true);
      CREATE POLICY app_update ON public.artists FOR UPDATE TO mn1655_rehearsal_app USING(true) WITH CHECK(true);
      CREATE POLICY app_read ON public.users FOR SELECT TO mn1655_rehearsal_app USING(true);
      CREATE POLICY app_lock ON public.users FOR UPDATE TO mn1655_rehearsal_app USING(true) WITH CHECK(false);
    `);
    assert.deepEqual(
      Array.from(
        await bootstrap`select distinct pg_get_userbyid(relowner) as owner from pg_class where oid in ('public.artists'::regclass,'public.users'::regclass,'mn_private.public_url_receipts'::regclass)`,
      ),
      [{ owner: names.owner }],
    );
    await bootstrap.end({ timeout: 1 });
    await operator.unsafe(
      "REVOKE mn1655_rehearsal_owner FROM mn1655_rehearsal_app; REVOKE mn1655_rehearsal_owner FROM mn1655_rehearsal_operator",
    );
    await operator.end({ timeout: 1 });
    assert.equal(
      (
        await admin`select pid from pg_stat_activity where datname=${names.database} and usename=${names.app}`
      ).length,
      0,
      "Bootstrap session still exists",
    );
    const app = open(names.app, names.database);
    const [role] =
      await app`select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname=current_user`;
    assert.deepEqual(role, {
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
    });
    assert.equal(
      (
        await app`select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=current_user)`
      ).length,
      0,
    );
    const denied = async query => assert.rejects(app.unsafe(query), { code: "42501" });
    await denied("SET ROLE mn1655_rehearsal_owner");
    await denied("SET ROLE mnweb");
    await denied("CREATE TABLE public.forbidden(id int)");
    await denied("CREATE TEMP TABLE forbidden(id int)");
    await denied("UPDATE public.artists SET private_note='changed' WHERE id=1");
    await denied("UPDATE public.users SET id=2 WHERE id=1");
    await app`select id from public.users where id=1 for share`;
    await app`update public.artists set bio='Synthetic About' where id=1`;
    await app`insert into mn_private.public_url_receipts values('https://example.org/synthetic')`;
    await denied(
      "DELETE FROM mn_private.public_url_receipts WHERE url='https://example.org/synthetic'",
    );
    assert.deepEqual(Array.from(await app`select bio from public.artists where id=1`), [
      { bio: "Synthetic About" },
    ]);
    const shared = open(names.app);
    await assert.rejects(shared.unsafe("SELECT * FROM mn1655_rehearsal_shared.secret"), {
      code: "42501",
    });
    console.log(
      JSON.stringify({
        roleRehearsal: "passed",
        standaloneDriverCreate: true,
        runtimeOwnerMembership: false,
        freshSessionDdlDenied: true,
        sharedFixtureReadDenied: true,
        allowedWriteAndLock: true,
        hostedConnectorCreate: "unproven",
        passwordExpiryAndPooler: "not tested",
        scope: "reduced privilege fixture, not full application bootstrap",
      }),
    );
  } finally {
    // Close only this invocation's clients; never terminate unrelated sessions.
    for (const connection of connections.slice(1)) await connection.end({ timeout: 1 });
    if (databaseOid) {
      assert.equal(
        (await admin`select oid from pg_database where datname=${names.database}`)[0]?.oid,
        databaseOid,
        "Database identity drift",
      );
      await admin.unsafe("DROP DATABASE mn1655_rehearsal_db");
    }
    if (sharedSchemaOid) {
      assert.equal(
        (await admin`select oid from pg_namespace where nspname=${names.sharedSchema}`)[0]?.oid,
        sharedSchemaOid,
        "Schema identity drift",
      );
      await admin.unsafe("DROP SCHEMA mn1655_rehearsal_shared CASCADE");
    }
    for (const [role, oid] of [...createdRoles].reverse()) {
      assert.equal(
        (await admin`select oid from pg_roles where rolname=${role}`)[0]?.oid,
        oid,
        "Role identity drift",
      );
      await admin.unsafe(`DROP ROLE ${role}`); // Fixed names above, never caller-supplied SQL identifiers.
    }
    await admin.end({ timeout: 1 });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(
    process.env.MN_APPROVED_SYNTHETIC_PG17,
    "yes",
    "Explicit local rehearsal flag required",
  );
  await rehearseBootstrapRoles(process.env.MN_1655_PG_SOCKET);
}

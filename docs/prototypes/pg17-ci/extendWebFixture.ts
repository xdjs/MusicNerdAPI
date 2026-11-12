import { readFileSync } from "node:fs";
import type postgres from "postgres";

type Column = {
  name: string;
  sqlType: string;
  enumValues: string[] | null;
  primary: boolean;
  default: null | { sql?: string; value?: unknown };
};
/** Extend only the verified disposable fixture for real Web reads/actions; not production DDL. */
export async function extendWebFixture(admin: postgres.Sql, names: Set<string>) {
  const [identity] =
    await admin`select current_database() as db, current_setting('listen_addresses') as addresses`;
  if (identity.db !== "mn_1655_synthetic" || identity.addresses !== "")
    throw new Error("Local fixture required");
  const manifest = JSON.parse(
    readFileSync(
      "/tmp/mn-1655-web-review-20261105/docs/testing/local-1655-next/schema-fixture.json",
      "utf8",
    ),
  ) as { tables: { name: string; schema: string; columns: Column[] }[] };
  const ident = (name: string) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw Error("Invalid fixture identifier");
    return `"${name}"`;
  };
  const types = new Set([
    "bigint",
    "boolean",
    "date",
    "integer",
    "jsonb",
    "numeric",
    "text",
    "text[]",
    "timestamp",
    "timestamp with time zone",
    "uuid",
  ]);
  for (const table of manifest.tables) {
    if (table.schema !== "public") continue;
    const name = ident(table.name);
    const exists = names.has(table.name);
    if (!exists) {
      await admin.unsafe(
        `create table ${name} ();alter table ${name} enable row level security;create policy synthetic_mnweb on ${name} to mnweb using(true) with check(true);grant select,insert,update,delete on ${name} to mnweb`,
      );
      names.add(table.name);
    }
    const existing =
      await admin`select column_name from information_schema.columns where table_schema='public' and table_name=${table.name}`;
    for (const column of table.columns) {
      const col = ident(column.name);
      const type = types.has(column.sqlType)
        ? column.sqlType
        : column.sqlType.endsWith("[]")
          ? "text[]"
          : "text";
      if (!existing.some(c => c.column_name === column.name))
        await admin.unsafe(
          `alter table ${name} add column ${col} ${type}${column.primary ? " primary key" : ""}`,
        );
      const value = column.default;
      if (value === null) continue;
      let expression: string;
      if (value.sql) {
        expression = value.sql.replace("uuid_generate_v4()", "gen_random_uuid()");
        if (
          ![
            "now()",
            "clock_timestamp()",
            "gen_random_uuid()",
            "'{}'::jsonb",
            "'[]'::jsonb",
            "(now() AT TIME ZONE 'utc'::text)",
          ].includes(expression)
        )
          throw Error("Unexpected fixture default");
      } else if (type.endsWith("[]")) {
        expression = `ARRAY[${(value.value as string[]).map(v => `'${v.replaceAll("'", "''")}'`).join(",")}]::${type}`;
      } else
        expression = `'${(typeof value.value === "object" ? JSON.stringify(value.value) : String(value.value)).replaceAll("'", "''")}'::${type}`;
      await admin.unsafe(`alter table ${name} alter column ${col} set default ${expression}`);
    }
  }
  const functions = readFileSync(
    new URL("../hosted-about/bootstrap-functions.sql", import.meta.url),
    "utf8",
  );
  const snapshot = functions.slice(
    functions.indexOf("CREATE FUNCTION public.knowledge_vault_source_snapshot("),
    functions.indexOf("CREATE FUNCTION public.knowledge_social_post_snapshot("),
  );
  if (!snapshot.startsWith("CREATE FUNCTION public.knowledge_vault_source_snapshot("))
    throw new Error("Pinned source snapshot fixture missing");
  await admin.unsafe(snapshot);
  await admin.unsafe(
    "REVOKE ALL ON FUNCTION public.knowledge_vault_source_snapshot(public.artist_vault_sources) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.knowledge_vault_source_snapshot(public.artist_vault_sources) TO mnweb",
  );
}

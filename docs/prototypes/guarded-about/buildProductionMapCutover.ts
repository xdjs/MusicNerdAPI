import { buildFullArtistProjection } from "./buildFullArtistProjection";
import { useExistingUrlReceipts } from "./useExistingUrlReceipts";
import manifest from "./productionArtistColumns.json";

/** Reviewed target stage; caller must hold the enclosing legacy/migration transaction. */
export function buildProductionMapCutover(
  baseSql: string,
  operatorPreflight: string,
  postflight: string,
): string {
  const audit = "r.rolname NOT IN ('mnweb','mn_projection_reader')";
  if (baseSql.split(audit).length !== 2) throw new Error("Raw-reader audit template changed");
  const trusted =
    "r.rolname NOT IN ('mnweb','mn_projection_reader','postgres','supabase_etl_admin','supabase_read_only_user','cli_login_postgres')";
  const createRole = "CREATE ROLE mn_projection_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;";
  if (baseSql.split(createRole).length !== 2) throw new Error("Projection owner template changed");
  const ownerSql = baseSql.replace(
    createRole,
    `${createRole}\nGRANT mn_projection_reader TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;`,
  );
  const sql = buildFullArtistProjection(
    useExistingUrlReceipts(ownerSql.replace(audit, trusted)),
    { reader: null, mapEditor: "webmapdata_editor", publicReaders: false },
    manifest.columns,
  );
  if (!sql.startsWith("BEGIN;\n") || !sql.endsWith("COMMIT;"))
    throw new Error("Transaction template changed");
  return `-- Production-shaped candidate: approval and coordinated client cutover required.\nSAVEPOINT mn_about_map_cutover;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n${operatorPreflight}\n${sql.slice(7, -7)}\n${operatorPreflight}\n${postflight}\nREVOKE SET OPTION FOR mn_projection_reader FROM CURRENT_USER;\nREVOKE INHERIT OPTION FOR mn_projection_reader FROM CURRENT_USER;\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='mn_projection_reader' AND m.member=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND (m.inherit_option OR m.set_option)) THEN RAISE EXCEPTION 'Temporary projector privilege retained'; END IF; END $$;\nRELEASE SAVEPOINT mn_about_map_cutover;\n`;
}

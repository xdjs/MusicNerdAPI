import { sql } from "drizzle-orm";

/** The vault source revision: changes when the row, its extracted text, or its publication state changes. */
export function vaultSourceRevisionSql(alias = "v") {
  const a = sql.raw(alias);
  return sql`coalesce(${a}.updated_at, ${a}.created_at)::text || ':' || md5(coalesce(${a}.extracted_text, '')) || ':' || ${a}.publication`;
}

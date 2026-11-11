import { sql } from "drizzle-orm";
import { publicVaultSourceSql } from "./publicVaultSourceSql";
/** Text originals share the publication gate; binary PDFs retain their bounded PDF-reader path. */
export function publicTextVaultSourceSql() {
  return sql`(v.file_path is null or v.content_type in ('text/plain','text/markdown','text/csv','application/json')) and ${publicVaultSourceSql()}`;
}

import { sql } from "drizzle-orm";

/** Public-read policy for a vault row aliased v; ownership/edit rights are unchanged. */
export function publicVaultSourceSql() {
  return sql`v.status='approved' and (
    v.publication='public' or (v.publication='inherit' and exists(
      select 1 from artist_claims claim where claim.artist_id=v.artist_id and claim.status='approved'
    )))`;
}

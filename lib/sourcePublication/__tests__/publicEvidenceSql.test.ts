import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { publicEvidenceSql } from "@/lib/sourcePublication/publicEvidenceSql";
import { publicTextVaultSourceSql } from "@/lib/sourcePublication/publicTextVaultSourceSql";

const dialect = new PgDialect();
const render = (aliases?: { e: string; c: string }) =>
  dialect.sqlToQuery(publicEvidenceSql(aliases));
const vaultGate = dialect.sqlToQuery(publicTextVaultSourceSql()).sql;

describe("publicEvidenceSql", () => {
  it("renders every public-evidence condition with the default aliases", () => {
    const q = render();
    expect(q.sql).toBe(
      `(e.revision=c.current_revision and c.identity='confirmed' and c.curation in ('pending','approved') and not exists(select 1 from artist_vault_sources hidden where hidden.artist_id=c.artist_id and hidden.url=c.url and hidden.publication='private') and ((c.reviewed_revision is null and (c.destination is distinct from 'lore' or c.source_id is null)) or (c.destination='lore' and exists(select 1 from artist_vault_sources v where v.id=c.source_id and v.artist_id=c.artist_id and ${vaultGate})) or (c.destination='link' and exists(select 1 from artists a where a.id=c.artist_id and to_jsonb(a)->>c.platform=c.platform_id))))`,
    );
    expect(q.params).toEqual([]);
  });
  it("substitutes custom aliases for the evidence and candidate rows", () => {
    const q = render({ e: "ev", c: "cand" }).sql;
    expect(q).toContain("ev.revision=cand.current_revision");
    expect(q).toContain("cand.identity='confirmed'");
    expect(q).toContain("hidden.url=cand.url");
    expect(q).toContain("to_jsonb(a)->>cand.platform=cand.platform_id");
    expect(q).not.toMatch(/\bc\./);
    expect(q).not.toMatch(/\be\./);
  });
});

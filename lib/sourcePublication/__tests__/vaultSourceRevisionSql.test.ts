import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";

const render = (alias?: string) => new PgDialect().sqlToQuery(vaultSourceRevisionSql(alias));

describe("vaultSourceRevisionSql", () => {
  it("renders the revision formula with the default alias", () => {
    const q = render();
    expect(q.sql).toBe(
      "coalesce(v.updated_at, v.created_at)::text || ':' || md5(coalesce(v.extracted_text, '')) || ':' || v.publication",
    );
    expect(q.params).toEqual([]);
  });
  it("substitutes a custom alias", () => {
    expect(render("s").sql).toContain("coalesce(s.updated_at, s.created_at)::text");
    expect(render("s").sql).toContain("|| s.publication");
  });
});

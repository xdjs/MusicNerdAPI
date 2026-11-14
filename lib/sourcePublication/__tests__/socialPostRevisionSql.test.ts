import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";

const render = (alias?: string) => new PgDialect().sqlToQuery(socialPostRevisionSql(alias));

describe("socialPostRevisionSql", () => {
  it("renders the fingerprint of the snapshot with the default alias", () => {
    const q = render();
    expect(q.sql).toBe(
      "public.knowledge_source_fingerprint(public.knowledge_social_post_snapshot(s))",
    );
    expect(q.params).toEqual([]);
  });
  it("substitutes a custom alias", () => {
    expect(render("p").sql).toBe(
      "public.knowledge_source_fingerprint(public.knowledge_social_post_snapshot(p))",
    );
  });
});

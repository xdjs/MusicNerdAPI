import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { publicSocialPostSql } from "@/lib/sourcePublication/publicSocialPostSql";

const render = (alias?: string) => new PgDialect().sqlToQuery(publicSocialPostSql(alias));

describe("publicSocialPostSql", () => {
  it("renders the own-post, not-repost, not-retweet predicate with the default alias", () => {
    const q = render();
    expect(q.sql).toBe(
      "(s.is_own_post = true and s.raw->'isRepost' is distinct from 'true'::jsonb and s.raw->'isRetweet' is distinct from 'true'::jsonb)",
    );
    expect(q.params).toEqual([]);
  });
  it("substitutes a custom alias", () => {
    expect(render("p").sql).toBe(
      "(p.is_own_post = true and p.raw->'isRepost' is distinct from 'true'::jsonb and p.raw->'isRetweet' is distinct from 'true'::jsonb)",
    );
  });
});

import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { socialPostTextSql } from "@/lib/sourcePublication/socialPostTextSql";

const render = (alias?: string) => new PgDialect().sqlToQuery(socialPostTextSql(alias));

describe("socialPostTextSql", () => {
  it("renders the caption plus the guarded Instagram transcript with the default alias", () => {
    const q = render();
    expect(q.sql).toBe(
      "(case when s.platform = 'instagram' and s.raw->'_musicnerdTranscript'->'version' = '1'::jsonb and s.raw->'_musicnerdTranscript'->>'actor' = 'apify/instagram-reel-scraper' and jsonb_typeof(s.raw->'_musicnerdTranscript'->'text') = 'string' and btrim(s.raw->'_musicnerdTranscript'->>'text') <> '' then coalesce(nullif(s.caption, '') || E'\\n\\n', '') || (s.raw->'_musicnerdTranscript'->>'text') else coalesce(s.caption, '') end)",
    );
    expect(q.params).toEqual([]);
  });
  it("substitutes a custom alias", () => {
    const q = render("p").sql;
    expect(q).toContain("when p.platform = 'instagram'");
    expect(q).toContain("else coalesce(p.caption, '') end");
    expect(q).not.toMatch(/\bs\./);
  });
});

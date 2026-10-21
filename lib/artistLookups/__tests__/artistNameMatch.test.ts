import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { artistNameMatch } from "@/lib/artistLookups/artistNameMatch";

const render = (q: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(q);

describe("artistNameMatch", () => {
  it("normalises the name as the search does", () => {
    expect(artistNameMatch("Beyoncé!").query).toBe("beyonce");
  });

  it("matches the spaced and the legacy space-less lcname", () => {
    const { nameMatch, matchPosition } = artistNameMatch("Pete Rango");
    const match = render(nameMatch);
    expect(match.sql).toMatch(/lcname LIKE.*OR lcname LIKE/s);
    expect(match.params).toEqual(["pete rango", "peterango"]);
    expect(render(matchPosition).sql).toContain("COALESCE(NULLIF(POSITION(");
  });

  it("uses one LIKE when the name has no spaces, and never an empty pattern", () => {
    expect(render(artistNameMatch("Drake").nameMatch).params).toEqual(["drake"]);
    expect(render(artistNameMatch("   ").nameMatch).params).not.toContain("");
  });
});

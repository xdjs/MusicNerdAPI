import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

vi.mock("@/lib/db/db", () => ({ db: {} }));
const { getPublicArtistAbout } = await import("@/lib/bio/getPublicArtistAbout");

const about = {
  version: 1,
  bio: "Pete is a producer.",
  kind: "official",
  sources: [{ id: "s1", url: "https://example.com", label: "Site" }],
};

describe("getPublicArtistAbout", () => {
  it("reads the gated preparation for the artist", async () => {
    const execute = vi.fn().mockResolvedValueOnce([{ public_about: about }]);
    expect(await getPublicArtistAbout("a1", { execute } as never)).toEqual({
      bio: about.bio,
      kind: "official",
      sources: about.sources,
    });
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL);
    expect(q.params).toEqual(["a1"]);
    expect(q.sql).toContain("not exists(select 1 from artist_claims");
    expect(q.sql).toContain("p.status='ready'");
  });

  it("is null when no preparation passes the gates", async () => {
    const execute = vi.fn().mockResolvedValueOnce([]);
    expect(await getPublicArtistAbout("a1", { execute } as never)).toBeNull();
  });
});

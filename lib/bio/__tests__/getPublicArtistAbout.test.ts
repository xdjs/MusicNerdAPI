import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const { getPublicArtistAbout } = await import("@/lib/bio/getPublicArtistAbout");

const render = (q: SQL) => new PgDialect().sqlToQuery(q);
beforeEach(() => vi.clearAllMocks());

describe("getPublicArtistAbout", () => {
  it("returns the parsed public About for an unclaimed, unchanged artist", async () => {
    execute.mockResolvedValueOnce([
      {
        public_about: {
          version: 1,
          bio: "Public.",
          kind: "researched",
          sources: [{ id: "s", url: "https://e.com/x", label: "l" }],
        },
      },
    ]);
    expect(await getPublicArtistAbout("6cb3d81a-0000-4000-8000-000000000000")).toEqual({
      bio: "Public.",
      kind: "researched",
      sources: [{ id: "s", url: "https://e.com/x", label: "l" }],
    });
    const { sql, params } = render(execute.mock.calls[0][0]);
    expect(params).toEqual(["6cb3d81a-0000-4000-8000-000000000000"]);
    expect(sql).toContain("from artist_directory_preparations p");
    expect(sql).toContain("not exists(select 1 from artist_claims c where c.artist_id=a.id)");
    expect(sql).toContain("a.bio is not distinct from p.starting_bio");
    expect(sql).toContain("public.knowledge_vault_source_snapshot(v)");
  });

  it("is null when no row qualifies or the row does not parse", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await getPublicArtistAbout("x")).toBeNull();
    execute.mockResolvedValueOnce([{ public_about: { version: 0 } }]);
    expect(await getPublicArtistAbout("x")).toBeNull();
  });

  it("reads with the caller's transaction when given one", async () => {
    const reader = vi.fn().mockResolvedValueOnce([{ public_about: { version: 0 } }]);
    expect(await getPublicArtistAbout("x", { execute: reader } as never)).toBeNull();
    expect(reader).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});

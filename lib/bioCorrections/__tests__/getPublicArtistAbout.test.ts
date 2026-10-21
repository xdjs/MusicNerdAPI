import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getPublicArtistAbout } from "@/lib/bioCorrections/getPublicArtistAbout";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

const about = {
  version: 1,
  bio: "Bio Ritmo is a salsa band from Richmond.",
  kind: "researched",
  sources: [{ id: "s1", url: "https://example.com/bio-ritmo", label: "Example" }],
};

beforeEach(() => vi.clearAllMocks());

describe("getPublicArtistAbout", () => {
  it("reads the gated public_about projection for the artist", async () => {
    mock.execute.mockResolvedValueOnce([{ public_about: about }]);
    expect(await getPublicArtistAbout("a1")).toEqual({
      bio: about.bio,
      kind: "researched",
      sources: about.sources,
    });
    const { text, params } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(params).toEqual(["a1"]);
    expect(text).toContain("from artist_directory_preparations p");
    expect(text).toContain("p.status='ready'");
    expect(text).toContain("not exists(select 1 from artist_claims c where c.artist_id=a.id)");
    expect(text).toContain("b.is_pinned");
    expect(text).toContain("public.knowledge_vault_source_snapshot(v)");
  });

  it("is null when nothing is publishable, or the stored value is not a public About", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getPublicArtistAbout("a1")).toBeNull();
    mock.execute.mockResolvedValueOnce([{ public_about: { bio: "old private draft" } }]);
    expect(await getPublicArtistAbout("a1")).toBeNull();
  });

  it("reads with the caller's transaction when given one", async () => {
    const execute = vi.fn().mockResolvedValueOnce([{ public_about: about }]);
    await getPublicArtistAbout("a1", { execute } as never);
    expect(execute).toHaveBeenCalled();
    expect(mock.execute).not.toHaveBeenCalled();
  });
});

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";
const pg = new PGlite();
const database = drizzle(pg, { schema });
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: vi.fn(),
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: vi.fn(async () => undefined),
}));
const { persistArtistBio } = await import("../persistArtistBio");
const artist = "00000000-0000-4000-8000-000000000001",
  sourceId = "00000000-0000-4000-8000-000000000002";
const source = {
  id: sourceId,
  activityId: null,
  origin: "upload",
  publication: "public",
  url: "https://example.org/evidence",
  extractedText: "Verified evidence. ".repeat(30),
};
const sources = () => [
  {
    id: 1,
    kind: "vault" as const,
    label: "Evidence",
    url: source.url,
    revision: vaultSourceRevision(source),
  },
];
it("atomically keeps current/history evidence, same-text revisions and manual lineage without rewriting old versions", async () => {
  try {
    for (const [name, table] of Object.entries({
      artists: schema.artists,
      artist_bio_versions: schema.artistBioVersions,
      artist_docs: schema.artistDocs,
      artist_onboarding_steps: schema.artistOnboardingSteps,
      artist_vault_sources: schema.artistVaultSources,
      artist_activity_events: schema.artistActivityEvents,
    })) {
      const columns = Object.values(getTableColumns(table))
        .map(
          c =>
            `"${c.name}" ${"enumValues" in c && Array.isArray(c.enumValues) ? "text" : c.getSQLType()}${c.name === "id" ? " default gen_random_uuid()" : ""}`,
        )
        .join(",");
      await pg.exec(`create table ${name}(${columns})`);
    }
    await pg.exec(
      `create schema mn_private;create table mn_private.public_url_receipts(url_hash bytea,url text,policy_version integer,primary key(url_hash,policy_version)); create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb not null); create table mn_private.artist_bio_version_provenance(version_id uuid primary key,provenance jsonb not null);`,
    );
    await pg.exec(
      "alter table artist_docs add unique(artist_id);create table artist_claims(artist_id uuid,status text)",
    );
    await pg.query("insert into artists(id,bio) values($1,'Original manual')", [artist]);
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'upload','public','approved',$3,$4)",
      [sourceId, artist, source.url, source.extractedText],
    );
    const options = () => ({
      ownership: { expectedClaimId: null },
      generated: true,
      expectedBio: "Generated",
      documentOrigin: "server" as const,
      document: { content: "Lore", sources: sources() },
    });
    await persistArtistBio(artist, "Generated", { ...options(), expectedBio: "Original manual" });
    const first = (
      await pg.query<{ bio_provenance: unknown }>(
        "select provenance as bio_provenance from mn_private.artist_bio_provenance",
      )
    ).rows[0].bio_provenance;
    expect(first).toMatchObject({ kind: "generated", claimId: null, sources: sources() });
    await pg.exec("delete from mn_private.public_url_receipts");
    await persistArtistBio(artist, "Generated", options());
    expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
      { url: source.url },
    ]);

    expect(
      (
        await pg.query(
          "select v.bio_text,p.provenance as bio_provenance from artist_bio_versions v left join mn_private.artist_bio_version_provenance p on p.version_id=v.id",
        )
      ).rows,
    ).toEqual([
      { bio_text: "Original manual", bio_provenance: null },
      { bio_text: "Generated", bio_provenance: first },
    ]);
    source.extractedText = "Changed evidence. ".repeat(30);
    await pg.query("update artist_vault_sources set extracted_text=$1", [source.extractedText]);
    await persistArtistBio(artist, "Generated", options());
    const second = (
      await pg.query<{ bio_provenance: unknown }>(
        "select provenance as bio_provenance from mn_private.artist_bio_provenance",
      )
    ).rows[0].bio_provenance;
    expect(second).not.toEqual(first);
    expect(
      (
        await pg.query(
          "select p.provenance as bio_provenance from artist_bio_versions v left join mn_private.artist_bio_version_provenance p on p.version_id=v.id where bio_text='Generated'",
        )
      ).rows,
    ).toEqual([{ bio_provenance: first }, { bio_provenance: second }]);
    await persistArtistBio(artist, "Manual derivative", { ownership: { expectedClaimId: null } });
    expect(
      (
        await pg.query<{ bio_provenance: { sources: unknown } }>(
          "select provenance as bio_provenance from mn_private.artist_bio_provenance",
        )
      ).rows[0].bio_provenance.sources,
    ).toEqual(sources());
    await pg.exec(
      "create function reject_history() returns trigger language plpgsql as $$begin if new.bio_text='fail' then raise exception 'history failed';end if;return new;end$$;create trigger fail_history before insert on artist_bio_versions for each row execute function reject_history()",
    );
    await expect(
      persistArtistBio(artist, "fail", {
        ...options(),
        expectedBio: "Manual derivative",
        document: { content: "Must roll back", sources: sources() },
      }),
    ).rejects.toThrow();
    expect((await pg.query("select bio from artists")).rows).toEqual([
      { bio: "Manual derivative" },
    ]);
    expect((await pg.query("select content from artist_docs")).rows).toEqual([{ content: "Lore" }]);
    const before = async () => ({
      current: (await pg.query("select * from mn_private.artist_bio_provenance")).rows,
      history: (await pg.query("select * from artist_bio_versions order by id")).rows,
      evidence: (
        await pg.query("select * from mn_private.artist_bio_version_provenance order by version_id")
      ).rows,
    });
    const unchanged = await before();
    await pg.exec(
      "create function reject_evidence() returns trigger language plpgsql as $$begin raise exception 'private evidence failed';end$$;",
    );
    for (const table of ["artist_bio_provenance", "artist_bio_version_provenance"]) {
      await pg.exec(
        `create trigger fail_evidence before insert or update on mn_private.${table} for each row execute function reject_evidence()`,
      );
      await expect(
        persistArtistBio(artist, "Sidecar failure", { ownership: { expectedClaimId: null } }),
      ).rejects.toThrow();
      expect(await before()).toEqual(unchanged);
      expect((await pg.query("select bio from artists")).rows).toEqual([
        { bio: "Manual derivative" },
      ]);
      await pg.exec(`drop trigger fail_evidence on mn_private.${table}`);
    }
  } finally {
    await pg.close();
  }
}, 30000);

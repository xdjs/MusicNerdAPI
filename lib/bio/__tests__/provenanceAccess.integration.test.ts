import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("keeps provenance private while preserving existing public artist reads and legacy rows", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create role mnweb; create role anon; create role authenticated; create role inherited_public; grant anon to inherited_public;
      create table artists(id uuid primary key,bio text);
      create table artist_bio_versions(id uuid primary key,artist_id uuid references artists(id),bio_text text,is_pinned boolean);
      alter table artists enable row level security;
      create policy public_read on artists for select to public using(true);
      grant usage on schema public to public;
      grant select on artists to anon,authenticated;
      grant all on artists,artist_bio_versions to mnweb;
      create policy app_access on artists to mnweb using(true) with check(true);
      insert into artists values('00000000-0000-4000-8000-000000000001','Legacy');`);
    await pg.exec(
      readFileSync("/tmp/mn-about-trusted-web/drizzle/0061_about_evidence_provenance.sql", "utf8"),
    );
    await pg.exec("set role mnweb");
    await pg.exec(
      `insert into mn_private.artist_bio_provenance values('00000000-0000-4000-8000-000000000001','{"sources":[{"url":"https://example.org/private"}]}')`,
    );
    await pg.exec("reset role");
    for (const role of ["anon", "authenticated", "inherited_public"]) {
      await pg.exec(`set role ${role}`);
      expect((await pg.query("select * from public.artists")).rows).toEqual([
        { id: "00000000-0000-4000-8000-000000000001", bio: "Legacy" },
      ]);
      await expect(pg.query("select * from mn_private.artist_bio_provenance")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        pg.query("select * from mn_private.artist_bio_version_provenance"),
      ).rejects.toThrow(/permission denied/);
      await pg.exec("reset role");
    }
    await pg.exec("set role mnweb");
    expect(
      (await pg.query("select provenance from mn_private.artist_bio_provenance")).rows,
    ).toHaveLength(1);
  } finally {
    await pg.close();
  }
});

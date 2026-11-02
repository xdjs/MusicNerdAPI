import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: read }));
const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  },
}));
vi.mock("@/lib/storage/getPublicUrl", () => ({
  getPublicUrl: (b: string, p: string) => `https://public.example/${b}/${p}`,
}));
const { loadChatPdfs } = await import("@/lib/chatPdf/loadChatPdfs");
const artist = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await client.exec(`create table artist_claims(id uuid,artist_id uuid,status text);
 create table artist_vault_sources(id uuid,artist_id uuid,status text,content_type text,file_path text,file_size integer,title text,file_name text,url text,updated_at timestamptz,created_at timestamptz,extracted_text text);`);
  await client.query("insert into artist_claims values($1,$2,'approved')", [id, artist]);
  await client.query(
    "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,'archive.pdf','archive.pdf',$4,null,now(),null)",
    [
      id,
      artist,
      `${artist}/archive.pdf`,
      `https://public.example/vault-files/${artist}/archive.pdf`,
    ],
  );
}, 30000);
afterAll(async () => client.close());
it("uses null-extraction public upload metadata and excludes unpublished, private URL, wrong artist and revoked claims", async () => {
  expect(await loadChatPdfs(artist, id)).toHaveLength(1);
  expect(await loadChatPdfs(id)).toEqual([]);
  for (const status of ["pending", "rejected"]) {
    await client.query("update artist_vault_sources set status=$1", [status]);
    expect(await loadChatPdfs(artist)).toEqual([]);
  }
  await client.exec(
    "update artist_vault_sources set status='approved',url='https://private.example/file.pdf'",
  );
  expect(await loadChatPdfs(artist)).toEqual([]);
  await client.query("update artist_vault_sources set url=$1", [
    `https://public.example/vault-files/${artist}/archive.pdf`,
  ]);
  await client.exec("update artist_claims set status='rejected'");
  expect(await loadChatPdfs(artist)).toEqual([]);
});

it("filters unusable rows before the cap and ranks a named PDF beyond 32 eligible rows", async () => {
  await client.exec("update artist_claims set status='approved'; delete from artist_vault_sources");
  for (let i = 1; i <= 70; i++) {
    const sid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const path = `${artist}/document-${i}.pdf`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,$4,$5,$5,$6,null,now(),null)",
      [
        sid,
        artist,
        path,
        i <= 34 ? 5000000 : 100,
        `document-${i}.pdf`,
        `https://public.example/vault-files/${path}`,
      ],
    );
  }
  expect((await loadChatPdfs(artist)).length).toBe(32);
  const wanted = "00000000-0000-4000-8000-000000000070";
  expect((await loadChatPdfs(artist, undefined, "document-70.pdf"))[0].id).toBe(wanted);
  await client.exec("update artist_vault_sources set file_size=100");
  expect((await loadChatPdfs(artist, undefined, "document-70.pdf"))[0].id).toBe(wanted);
  await client.query(
    "update artist_vault_sources set url='https://private.example/file.pdf' where id <> $1",
    [wanted],
  );
  expect((await loadChatPdfs(artist))[0].id).toBe(wanted);
});

it("fails closed across transactional claim/source deletion and source rejection between tool phases", async () => {
  const { createChatPdfTools } = await import("@/lib/chatPdf/createChatPdfTools");
  const wanted = "00000000-0000-4000-8000-000000000070";
  const cite = vi.fn().mockReturnValue(1);
  const file = { bytes: Buffer.from("%PDF-test"), pages: 1, hash: "hash" };
  // These are PR102's committed revoke effects, exercised against the real reader SQL.
  const first = createChatPdfTools(artist, cite);
  await first.tools.searchPdfSources.execute!(
    { query: "document-70.pdf" },
    { toolCallId: "s", messages: [], context: {} },
  );
  read.mockImplementationOnce(async () => {
    await client.exec(
      "begin; delete from artist_claims; delete from artist_vault_sources; commit;",
    );
    return file;
  });
  expect(
    await first.tools.readPdfSource.execute!(
      { sourceId: wanted },
      { toolCallId: "r", messages: [], context: {} },
    ),
  ).toHaveProperty("error");
  expect(cite).not.toHaveBeenCalled();
  await client.query("insert into artist_claims values($1,$2,'approved')", [id, artist]);
  await client.query(
    "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,'x.pdf','x.pdf',$4,null,now(),null)",
    [wanted, artist, `${artist}/x.pdf`, `https://public.example/vault-files/${artist}/x.pdf`],
  );
  read.mockResolvedValue(file);
  const second = createChatPdfTools(artist, cite);
  await second.tools.searchPdfSources.execute!(
    { query: "x.pdf" },
    { toolCallId: "s", messages: [], context: {} },
  );
  await second.tools.readPdfSource.execute!(
    { sourceId: wanted },
    { toolCallId: "r", messages: [], context: {} },
  );
  // PR103's status/revision change must invalidate retained same-turn evidence too.
  await client.exec("update artist_vault_sources set status='rejected',updated_at=now()");
  await expect(second.assertCurrent()).rejects.toThrow("publication changed");
});

it("matches exact names before the cap and refuses duplicate names and ineligible named sources", async () => {
  const { createChatPdfTools } = await import("@/lib/chatPdf/createChatPdfTools");
  await client.exec("delete from artist_vault_sources; delete from artist_claims");
  await client.query("insert into artist_claims values($1,$2,'approved')", [id, artist]);
  for (let i = 1; i <= 40; i++) {
    const sid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const path = `${artist}/document-${i}.pdf`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,$4,$4,$5,null,now(),null)",
      [
        sid,
        artist,
        path,
        i >= 39 ? "unique.pdf" : `document-${i}.pdf`,
        `https://public.example/vault-files/${path}`,
      ],
    );
  }
  const context = { toolCallId: "n", messages: [], context: {} };
  const session = () =>
    createChatPdfTools(artist, vi.fn().mockReturnValue(1), undefined, "Read unique.pdf");
  read.mockClear();
  expect(await loadChatPdfs(artist, undefined, "UNIQUE.pdf", true)).toHaveLength(2);
  expect(
    await session().tools.readNamedPdf.execute!({ filename: "unique.pdf" }, context),
  ).toHaveProperty("error");
  expect(read).not.toHaveBeenCalled();
  await client.query("delete from artist_vault_sources where id=$1", [
    "00000000-0000-4000-8000-000000000039",
  ]);
  read.mockResolvedValue({ bytes: Buffer.from("%PDF-test"), pages: 1, hash: "hash" });
  expect(
    await session().tools.readNamedPdf.execute!({ filename: "unique.pdf" }, context),
  ).toMatchObject({ pages: 1 });
  expect(read).toHaveBeenCalledTimes(1);
  expect(await loadChatPdfs(artist, undefined, "unique", true)).toHaveLength(0);
  expect(await loadChatPdfs(id, undefined, "unique.pdf", true)).toHaveLength(0);
  for (const statement of [
    "update artist_claims set status='rejected'",
    "update artist_claims set status='approved'; update artist_vault_sources set status='pending'",
    "update artist_vault_sources set status='approved',url='https://private.example/file.pdf'",
  ]) {
    await client.exec(statement);
    read.mockClear();
    expect(
      await session().tools.readNamedPdf.execute!({ filename: "unique.pdf" }, context),
    ).toHaveProperty("error");
    expect(read).not.toHaveBeenCalled();
  }
});

it("does not select a shorter filename inside an explicitly named longer eligible filename", async () => {
  const { createChatPdfTools } = await import("@/lib/chatPdf/createChatPdfTools");
  await client.exec("delete from artist_vault_sources; update artist_claims set status='approved'");
  for (const [sid, title] of [
    [id, "my archive.pdf"],
    ["00000000-0000-4000-8000-000000000003", "archive.pdf"],
  ]) {
    const path = `${artist}/${title}`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,$4,$4,$5,null,now(),null)",
      [sid, artist, path, title, `https://public.example/vault-files/${path}`],
    );
  }
  const context = { toolCallId: "n", messages: [], context: {} };
  read.mockClear();
  for (const filename of ["archive.pdf", "my archive.pdf"]) {
    const tools = createChatPdfTools(artist, vi.fn(), undefined, "Read my archive.pdf").tools;
    expect(await tools.readNamedPdf.execute!({ filename }, context)).toHaveProperty("error");
  }
  expect(read).not.toHaveBeenCalled();
});

it("ranks topic matches in extraction before the cap and binds discovery to extraction changes", async () => {
  await client.exec("delete from artist_vault_sources; update artist_claims set status='approved'");
  for (let i = 1; i <= 40; i++) {
    const sid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const path = `${artist}/document-${i}.pdf`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,$4,$4,$5,null,now(),$6)",
      [
        sid,
        artist,
        path,
        `document-${i}.pdf`,
        `https://public.example/vault-files/${path}`,
        i === 40 ? "Background. ".repeat(2000) + "Producer alias chronology." : "Tour dates.",
      ],
    );
  }
  const wanted = "00000000-0000-4000-8000-000000000040";
  expect((await loadChatPdfs(artist, undefined, "producer alias"))[0].id).toBe(wanted);
  const { createChatPdfTools } = await import("@/lib/chatPdf/createChatPdfTools");
  const session = createChatPdfTools(artist, vi.fn());
  const context = { toolCallId: "test", messages: [], context: {} };
  await session.tools.searchPdfSources.execute!({ query: "producer alias" }, context);
  const before = (await loadChatPdfs(artist, wanted))[0].revision;
  await client.query(
    "update artist_vault_sources set extracted_text='Changed extraction' where id=$1",
    [wanted],
  );
  expect((await loadChatPdfs(artist, wanted))[0].revision).not.toBe(before);
  read.mockClear();
  expect(await session.tools.readPdfSource.execute!({ sourceId: wanted }, context)).toHaveProperty(
    "error",
  );
  expect(read).not.toHaveBeenCalled();
});

it.each(["音楽", "声", "музыка", "موسيقى"])(
  "discovers body-only Unicode topic %s with parameterized SQL and unchanged visibility",
  async topic => {
    await client.exec(
      "delete from artist_vault_sources; update artist_claims set status='approved'",
    );
    const wanted = "00000000-0000-4000-8000-000000000040";
    for (let i = 1; i <= 40; i++) {
      const sid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      const path = `${artist}/archive-${i}.pdf`;
      await client.query(
        "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,$4,$4,$5,null,now(),$6)",
        [
          sid,
          artist,
          path,
          `archive-${i}.pdf`,
          `https://public.example/vault-files/${path}`,
          i === 40 ? `Background. ${topic} history.` : "Unrelated schedule.",
        ],
      );
    }
    const execute = vi.spyOn(driver, "execute");
    try {
      expect((await loadChatPdfs(artist, undefined, topic))[0].id).toBe(wanted);
      const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
      expect(compiled.sql).not.toContain(topic);
      expect(compiled.params).toContain(topic);
      await loadChatPdfs(artist, undefined, `${topic}'); DROP TABLE artist_vault_sources; --`);
      expect((await loadChatPdfs(artist, undefined, topic))[0].id).toBe(wanted);
      await client.query("update artist_vault_sources set status='pending' where id=$1", [wanted]);
      expect((await loadChatPdfs(artist, undefined, topic)).some(s => s.id === wanted)).toBe(false);
      await client.exec(
        "update artist_vault_sources set status='approved'; update artist_claims set status='rejected'",
      );
      expect(await loadChatPdfs(artist, undefined, topic)).toEqual([]);
    } finally {
      execute.mockRestore();
    }
  },
);

it("bounds and deduplicates Unicode topic terms without interpolating query text", async () => {
  const execute = vi.spyOn(driver, "execute");
  try {
    await loadChatPdfs(artist, undefined, Array.from({ length: 20 }, (_, i) => `音${i}`).join(" "));
    const bounded = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    // Two position expressions per ranked term, plus the existing filename check.
    expect(bounded.sql.match(/position\(/g)).toHaveLength(33);
    execute.mockClear();
    await loadChatPdfs(artist, undefined, "音 ".repeat(150) + "outside");
    const deduplicated = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(deduplicated.sql.match(/position\(/g)).toHaveLength(3);
    expect(deduplicated.params).toContain("音");
    expect(deduplicated.params).not.toContain("outside");
  } finally {
    execute.mockRestore();
  }
});

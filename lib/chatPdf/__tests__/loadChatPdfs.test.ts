import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
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

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

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
  getPublicUrl: (bucket: string, path: string) => `https://public.example/${bucket}/${path}`,
}));
const { loadChatPdfs } = await import("@/lib/chatPdf/loadChatPdfs");
const artist = "00000000-0000-4000-8000-000000000001";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  await client.exec(`create table artist_claims(id uuid,artist_id uuid,status text);
    create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,
    actor_user_id uuid,trigger text,action text);
    create table artist_vault_sources(id uuid,artist_id uuid,status text,content_type text,
    file_path text,file_size integer,title text,file_name text,url text,
    updated_at timestamptz,created_at timestamptz,extracted_text text,
    publication text not null default 'inherit',activity_id uuid,origin text);`);
}, 30000);
beforeEach(async () => {
  read.mockReset();
  await client.exec(
    "delete from artist_claims; delete from artist_vault_sources; delete from artist_activity_events",
  );
  await client.query("insert into artist_claims values($1,$2,'approved')", [id(99), artist]);
  for (let n = 1; n <= 40; n++) {
    const path = `${artist}/archive-${n}.pdf`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,100,$4,$4,$5,null,'2026-01-01',$6)",
      [
        id(n),
        artist,
        path,
        `archive-${n}.pdf`,
        `https://public.example/vault-files/${path}`,
        n === 40
          ? "The artist used the alias 蒼風 on a credited recording."
          : "Unrelated percussion session.",
      ],
    );
  }
});
afterAll(async () => client.close());

it("ranks a topic found only in stored extracted text, including short non-Latin terms, before the cap", async () => {
  expect((await loadChatPdfs(artist, undefined, "蒼風"))[0].id).toBe(id(40));
  expect((await loadChatPdfs(artist, undefined, "alias"))[0].id).toBe(id(40));
  expect((await loadChatPdfs(artist, undefined, "artist alias years"))[0].id).toBe(id(40));
});

it("parameterizes query terms rather than interpolating them", async () => {
  await loadChatPdfs(artist, undefined, "蒼風'); drop table artist_claims; --");
  expect(
    (await client.query<{ n: number }>("select count(*)::int n from artist_claims")).rows[0].n,
  ).toBe(1);
});

it("changes the revision when stored extraction changes, without claiming byte verification", async () => {
  const before = (await loadChatPdfs(artist, id(40)))[0];
  await client.query(
    "update artist_vault_sources set extracted_text='Changed alias statement.' where id=$1",
    [id(40)],
  );
  const after = (await loadChatPdfs(artist, id(40)))[0];
  expect(after.revision).not.toBe(before.revision);
  expect(after.url).toBe(before.url);
});

it("preserves claim, approval, public-URL and artist gates for content matches", async () => {
  await client.exec("delete from artist_claims");
  expect(await loadChatPdfs(artist, undefined, "蒼風")).toEqual([]);
  await client.query("insert into artist_claims values($1,$2,'pending')", [id(99), artist]);
  expect(await loadChatPdfs(artist, undefined, "蒼風")).toEqual([]);
  await client.exec("update artist_claims set status='approved'");
  for (const status of ["pending", "rejected"]) {
    await client.query("update artist_vault_sources set status=$1 where id=$2", [status, id(40)]);
    expect(await loadChatPdfs(artist, id(40), "蒼風")).toEqual([]);
  }
  await client.query(
    "update artist_vault_sources set status='approved',url='https://private.example/x.pdf' where id=$1",
    [id(40)],
  );
  expect(await loadChatPdfs(artist, id(40), "蒼風")).toEqual([]);
  expect(await loadChatPdfs(id(98), id(40), "蒼風")).toEqual([]);
});

it("returns a short whitespace-collapsed preview of stored extraction so discovery can judge relevance", async () => {
  await client.query("update artist_vault_sources set extracted_text=$1 where id=$2", [
    "Dutch VonEpp Ziegler\n\nIncomplete   Chronological Discography\nAliases / Identities:\n" +
      "x".repeat(400),
    id(40),
  ]);
  const [row] = await loadChatPdfs(artist, id(40));
  expect(row.preview).toBe(
    (
      "Dutch VonEpp Ziegler Incomplete Chronological Discography Aliases / Identities: " +
      "x".repeat(400)
    ).slice(0, 240),
  );
  await client.query("update artist_vault_sources set extracted_text=null where id=$1", [id(40)]);
  expect((await loadChatPdfs(artist, id(40)))[0].preview).toBe("");
  const { createChatPdfTools } = await import("@/lib/chatPdf/createChatPdfTools");
  const session = createChatPdfTools(artist, vi.fn());
  const result = (await session.tools.searchPdfSources.execute!(
    { query: "percussion" },
    { toolCallId: "s", messages: [], context: {} },
  )) as { sources: { sourceId: string; preview: string }[] };
  expect(result.sources[0]).toMatchObject({ preview: "Unrelated percussion session." });
});

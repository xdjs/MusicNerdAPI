import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MAX_VAULT_FILE_BYTES } from "@/lib/vaultUpload/const";

const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  },
}));
const { loadUnitSource } = await import("@/lib/units/loadUnitSource");

const artist = "00000000-0000-4000-8000-000000000001";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const pdfBytes = new TextEncoder().encode("%PDF-1.4 fake body");

const insertVault = (
  n: number,
  o: {
    url?: string | null;
    title?: string | null;
    file_name?: string | null;
    file_path?: string | null;
    content_type?: string | null;
    extracted_text?: string | null;
    status?: string;
  },
) =>
  client.query(
    `insert into artist_vault_sources(id,artist_id,url,title,file_name,file_path,content_type,extracted_text,status)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id(n),
      artist,
      o.url ?? null,
      o.title ?? null,
      o.file_name ?? null,
      o.file_path ?? null,
      o.content_type ?? null,
      o.extracted_text ?? null,
      o.status ?? "pending",
    ],
  );

beforeAll(async () => {
  await client.exec(`
    create table artist_vault_sources(id uuid,artist_id uuid,url text,title text,file_name text,file_path text,content_type text,extracted_text text,publication text not null default 'inherit',status text,updated_at timestamptz,created_at timestamptz default '2026-01-02T00:00:00Z');
    create table artist_social_posts(id uuid,artist_id uuid,caption text,url text,is_own_post boolean,raw jsonb);
    create table artist_research_candidates(id uuid,url text);
    create table artist_research_evidence(id uuid,candidate_id uuid,artist_id uuid,revision text,title text,original_text text);
    create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select to_jsonb(s)';
    create function knowledge_source_fingerprint(j jsonb) returns text language sql as 'select ''fp:'' || md5(j::text)';
  `);
  await insertVault(1, {
    url: "https://files.example/a.pdf",
    file_name: "a.pdf",
    file_path: "p/a.pdf",
    content_type: "application/pdf",
    extracted_text: "extracted pdf text",
  });
  await insertVault(2, {
    url: "https://files.example/b.pdf",
    title: "B Title",
    file_name: "b.pdf",
    file_path: "p/b.pdf",
    content_type: "application/pdf",
  });
  await insertVault(3, {
    url: "https://files.example/n.md",
    file_name: "n.md",
    file_path: "p/n.md",
    content_type: "text/markdown",
    extracted_text: "# Notes\n\nbody",
  });
  await insertVault(4, {
    url: "https://example.com/article",
    title: "Article",
    extracted_text: "web page text",
    status: "approved",
  });
  await insertVault(5, {
    url: "https://files.example/c.csv",
    file_name: "c.csv",
    file_path: "p/c.csv",
    content_type: "text/csv",
  });
  await client.query(
    `insert into artist_social_posts values($1,$2,'Caption here','https://instagram.com/p/x',true,$3),
     ($4,$2,'Reposted','https://instagram.com/p/y',true,'{"isRepost":true}'),
     ($5,$2,'Not mine','https://instagram.com/p/z',false,'{}'),
     ($6,$2,'Only caption','https://instagram.com/p/w',true,'{}')`,
    [
      id(10),
      artist,
      JSON.stringify({ _musicnerdTranscript: { version: 1, text: "spoken words" } }),
      id(11),
      id(12),
      id(13),
    ],
  );
  await client.query(
    "insert into artist_research_candidates values($1,'https://example.com/found')",
    [id(20)],
  );
  await client.query(
    "insert into artist_research_evidence values($1,$2,$3,'rev-7','Found title','original words')",
    [id(21), id(20), artist],
  );
}, 30000);
afterAll(async () => client.close());
afterEach(() => vi.unstubAllGlobals());

const pdfResponse = (bytes: Uint8Array) => new Response(bytes as BodyInit, { status: 200 });

describe("loadUnitSource", () => {
  it("loads a vault PDF with the supplied bytes and does not fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(1) }, { bytes: pdfBytes });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s).toMatchObject({
      sourceKind: "vault",
      sourceId: id(1),
      artistId: artist,
      title: "a.pdf",
      url: "https://files.example/a.pdf",
      extractedTextIsNull: false,
      body: { kind: "pdf", bytes: pdfBytes },
    });
    expect(s?.sourceRevision).toBe(await expectedVaultRevision(id(1)));
  });

  it("fetches a vault PDF from its url when no bytes are given", async () => {
    const fetchMock = vi.fn(async () => pdfResponse(pdfBytes));
    vi.stubGlobal("fetch", fetchMock);
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(2) });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]).toEqual(["https://files.example/b.pdf", expect.anything()]);
    expect(s?.title).toBe("B Title");
    expect(s?.extractedTextIsNull).toBe(true);
    expect(s?.body.kind).toBe("pdf");
    expect(Array.from((s!.body as { bytes: Uint8Array }).bytes)).toEqual(Array.from(pdfBytes));
  });

  it("rejects a fetched PDF over the vault size limit", async () => {
    const big = new Uint8Array(MAX_VAULT_FILE_BYTES + 1);
    big.set(pdfBytes);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => pdfResponse(big)),
    );
    await expect(loadUnitSource({ sourceKind: "vault", sourceId: id(2) })).rejects.toThrow(
      /exceeds/,
    );
  });

  it("rejects a fetched body that is not a PDF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => pdfResponse(new TextEncoder().encode("<html>nope</html>"))),
    );
    await expect(loadUnitSource({ sourceKind: "vault", sourceId: id(2) })).rejects.toThrow(
      /not a PDF/,
    );
  });

  it("loads vault markdown", async () => {
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(3) });
    expect(s).toMatchObject({
      title: "n.md",
      url: "https://files.example/n.md",
      extractedTextIsNull: false,
      body: { kind: "markdown", text: "# Notes\n\nbody" },
    });
  });

  it("loads a vault web page as plain text, whatever its status", async () => {
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(4) });
    expect(s).toMatchObject({
      title: "Article",
      url: "https://example.com/article",
      body: { kind: "plain", text: "web page text" },
    });
  });

  it("gives a text upload with no extracted text the none body", async () => {
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(5) });
    expect(s).toMatchObject({ extractedTextIsNull: true, body: { kind: "none" } });
  });

  it("selects the vault revision in SQL", async () => {
    const s = await loadUnitSource({ sourceKind: "vault", sourceId: id(4) });
    expect(s?.sourceRevision).toBe(await expectedVaultRevision(id(4)));
    expect(s?.sourceRevision).toMatch(/:[0-9a-f]{32}:inherit$/);
  });

  it("loads an own social post with its transcript appended", async () => {
    const s = await loadUnitSource({ sourceKind: "social", sourceId: id(10) });
    expect(s).toMatchObject({
      sourceKind: "social",
      artistId: artist,
      title: null,
      url: "https://instagram.com/p/x",
      extractedTextIsNull: false,
      body: { kind: "plain", text: "Caption here\n\nspoken words" },
    });
    expect(s?.sourceRevision).toMatch(/^fp:[0-9a-f]{32}$/);
  });

  it("loads a social post without a transcript as the caption alone", async () => {
    const s = await loadUnitSource({ sourceKind: "social", sourceId: id(13) });
    expect(s?.body).toEqual({ kind: "plain", text: "Only caption" });
  });

  it("returns null for reposts and posts that are not the artist's own", async () => {
    expect(await loadUnitSource({ sourceKind: "social", sourceId: id(11) })).toBeNull();
    expect(await loadUnitSource({ sourceKind: "social", sourceId: id(12) })).toBeNull();
  });

  it("loads evidence joined to its candidate", async () => {
    const s = await loadUnitSource({ sourceKind: "evidence", sourceId: id(21) });
    expect(s).toEqual({
      sourceKind: "evidence",
      sourceId: id(21),
      artistId: artist,
      title: "Found title",
      url: "https://example.com/found",
      sourceRevision: "rev-7",
      extractedTextIsNull: false,
      body: { kind: "plain", text: "original words" },
    });
  });

  it("returns null for a missing row of any kind", async () => {
    const missing = "00000000-0000-4000-8000-0000000009ff";
    for (const sourceKind of ["vault", "social", "evidence"] as const)
      expect(await loadUnitSource({ sourceKind, sourceId: missing })).toBeNull();
  });
});

async function expectedVaultRevision(sourceId: string) {
  const r = await client.query<{ r: string }>(
    `select coalesce(updated_at, created_at)::text || ':' || md5(coalesce(extracted_text, '')) || ':' || publication as r from artist_vault_sources where id=$1`,
    [sourceId],
  );
  return r.rows[0].r;
}

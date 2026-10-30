import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export const ARTIST = "00000000-0000-4000-8000-000000000106";
export const SOURCE = "00000000-0000-4000-8000-000000000107";
export const OTHER = "00000000-0000-4000-8000-000000000108";
export const ORIGIN = "https://fixture.invalid";
export const DOCUMENTS = JSON.parse(
  readFileSync("benchmarks/pdf106v2/fixtures/documents.json", "utf8"),
) as { id: string; title: string; file: string; pages: number; bytes: number; sha256: string }[];
export let fixtureDirectory = "../evidence";
export function setFixtureDirectory(path: string) {
  fixtureDirectory = path;
}
export function documentBytes(id: string) {
  const d = DOCUMENTS.find(d => d.id === id);
  if (!d) throw Error("Unknown fixture");
  const bytes = readFileSync(`${fixtureDirectory}/${d.file}`);
  if (bytes.length !== d.bytes || createHash("sha256").update(bytes).digest("hex") !== d.sha256)
    throw Error("Fixture changed");
  return bytes;
}
export const runtime = {
  startedAt: 0,
  transport: [] as {
    requestMs: number;
    fileParts: number;
    responseHeadersMs?: number;
    firstRawChunkMs?: number;
  }[],
  synthetic: false,
  allowedDoc: undefined as string | undefined,
  db: undefined as
    | undefined
    | {
        execute: (q: unknown) => Promise<unknown[]>;
        transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
      },
  model: undefined as unknown,
  observe: undefined as undefined | ((r: unknown) => void),
  modelOptions: [] as { maxOutputTokens: number; maxRetries: number }[],
  fixtureReads: [] as string[],
  syntheticWebAttempts: 0,
};
export async function setupFixture(extracted: boolean) {
  for (const d of DOCUMENTS) documentBytes(d.id);
  const client = new PGlite();
  const driver = drizzle(client);
  // PGlite is single-process/serial. This fixture-only lock replaces only the advisory primitive,
  // not the actual production allowance counting/admission SQL.
  await client.exec(`create function pg_advisory_xact_lock(integer) returns void language sql as 'select';
 create table artist_claims(id uuid,artist_id uuid,status text);
 create table artist_vault_sources(id uuid,artist_id uuid,status text,content_type text,file_path text,file_size integer,title text,file_name text,url text,updated_at timestamptz,created_at timestamptz,extracted_text text);
 create table question_planning_admissions(visitor_key text,admitted_at timestamptz);
 create table artist_activity_events(id bigserial primary key,artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,created_at timestamptz);`);
  await client.query("insert into artist_claims values($1,$2,$3)", [SOURCE, ARTIST, "approved"]);
  for (const d of DOCUMENTS) {
    const path = `${ARTIST}/${d.id}.pdf`;
    await client.query(
      "insert into artist_vault_sources values($1,$2,'approved','application/pdf',$3,$4,$5,$5,$6,null,'2026-10-30T00:00:00Z',$7)",
      [
        d.id,
        ARTIST,
        path,
        d.bytes,
        d.title,
        `${ORIGIN}/storage/v1/object/public/vault-files/${path}`,
        extracted ? "Fixture row has extracted text; original remains authoritative" : null,
      ],
    );
  }
  const execute = async (q: unknown) =>
    (await driver.execute(q as Parameters<typeof driver.execute>[0])).rows;
  runtime.db = {
    execute,
    transaction: async fn =>
      client.transaction(async tx => {
        const d = drizzle(tx as unknown as PGlite);
        return fn({
          execute: async (q: unknown) =>
            (await d.execute(q as Parameters<typeof d.execute>[0])).rows,
        });
      }),
  };
  runtime.synthetic = true;
  runtime.fixtureReads = [];
  runtime.syntheticWebAttempts = 0;
  return {
    client,
    close: async () => {
      runtime.synthetic = false;
      runtime.db = undefined;
      await client.close();
    },
  };
}

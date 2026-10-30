// Read only the two already inspected approved public originals for isolated evaluation.
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const hash = value => createHash("sha256").update(value).digest("hex");
const connection = new URL(process.env.SUPABASE_DB_CONNECTION ?? "");
const ref = connection.hostname.startsWith("db.")
  ? connection.hostname.split(".")[1]
  : decodeURIComponent(connection.username).split(".").at(-1);
const origin = `https://${ref}.supabase.co`;
if (hash(origin) !== "f8350d3631d8e76f00b601c021cd2ee682d40ab01d27c78da1d2bb644ab16c13")
  throw Error("Unexpected source project");
const docs = JSON.parse(readFileSync("benchmarks/pdf106v2/fixtures/documents.json", "utf8"));
const ids = ["84b02b2a-a406-4ca0-9adf-757a5f494d02", "2c623f78-412c-48f1-8a9b-2a3890e11e4d"];
const artist = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const output = resolve(process.argv[2]);
mkdirSync(output, { recursive: true });
const sql = postgres(process.env.SUPABASE_DB_CONNECTION, { max: 1, prepare: false });
try {
  for (let i = 0; i < docs.length; i++) {
    const rows =
      await sql`select file_path,url,content_type,file_size from artist_vault_sources where id=${ids[i]}::uuid and artist_id=${artist}::uuid and status='approved'`;
    const row = rows[0],
      doc = docs[i];
    if (
      rows.length !== 1 ||
      row.content_type !== "application/pdf" ||
      Number(row.file_size) !== doc.bytes ||
      !row.file_path.startsWith(artist + "/") ||
      row.url !== origin + "/storage/v1/object/public/vault-files/" + row.file_path
    )
      throw Error("Original source identity changed");
    const response = await fetch(row.url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Original unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== doc.bytes || hash(bytes) !== doc.sha256)
      throw Error("Original bytes changed");
    writeFileSync(resolve(output, doc.file), bytes, { mode: 0o600 });
    console.log(`Verified original: ${doc.pages} pages, ${doc.bytes} bytes, SHA-256 ${doc.sha256}`);
  }
} catch {
  console.error("Original preparation failed; no answer requests submitted.");
  process.exitCode = 1;
} finally {
  await sql.end();
}

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { CASES } from "./cases";

/** Read-only staging identity/public-corpus checks. No source or claim mutation. */
export async function preflight() {
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const connection = new URL(process.env.SUPABASE_DB_CONNECTION ?? "");
  const ref = connection.hostname.startsWith("db.")
    ? connection.hostname.split(".")[1]
    : decodeURIComponent(connection.username).split(".").at(-1);
  const origin = `https://${ref}.supabase.co`;
  // Frozen public staging origin fingerprint, not a credential or database identifier.
  if (hash(origin) !== "f8350d3631d8e76f00b601c021cd2ee682d40ab01d27c78da1d2bb644ab16c13")
    throw new Error("Database target is not the verified staging project");
  process.env.SUPABASE_URL = origin;
  const corpus: Record<string, { count: number; hash: string }> = {};
  for (const c of [CASES[0], CASES[2]]) {
    const artist = await loadResearchArtist(c.artistId);
    if (artist.name !== c.artistName) throw new Error("Staging artist identity mismatch");
    const originals = await loadPublicResearchOriginals(c.artistId);
    corpus[c.artistId] = {
      count: originals.length,
      hash: hash(JSON.stringify(originals.sort((a, b) => a.sourceId.localeCompare(b.sourceId)))),
    };
  }
  const rows = await db.execute<{
    id: string;
    title: string;
    url: string;
    path: string;
    revision: string;
  }>(sql`
    select v.id,coalesce(v.title,v.file_name,'PDF') as title,v.url,v.file_path as path,
      coalesce(v.updated_at,v.created_at)::text as revision
    from artist_vault_sources v
    where v.artist_id=${CASES[2].artistId}::uuid and v.status='approved'
      and exists(select 1 from artist_claims c where c.artist_id=v.artist_id and c.status='approved')
      and v.content_type='application/pdf' and v.file_size>0 and v.file_size<=4194304
      and v.url=${origin + "/storage/v1/object/public/vault-files/"} || v.file_path
      and split_part(v.file_path,'/',1)=${CASES[2].artistId}
      and v.file_path ~ '^[a-zA-Z0-9_. -]+(/[a-zA-Z0-9_. -]+)+$'
      and not exists(select 1 from unnest(string_to_array(v.file_path,'/')) segment where segment in ('.','..'))
    order by v.id`);
  const pdfs = [];
  const wanted = [
    {
      name: "dutch_discography_timeline.pdf",
      hash: "9f3503adb85313afc65dfe1443a652a67942aaeb6ab309aa80d50d60f62db09c",
    },
    {
      name: "Dutchyyy VS The Algorithms (short)_compressed.pdf",
      hash: "33c29a5285407551d923c69e5b63831d582688bc0016b02d90301faed82d8d8d",
    },
  ];
  for (const gold of wanted) {
    const row = rows.find(r => r.title === gold.name);
    if (!row) continue;
    const response = await fetch(row.url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Public gold PDF unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 4194304 || createHash("sha256").update(bytes).digest("hex") !== gold.hash)
      throw new Error("Public gold PDF changed");
    pdfs.push({
      id: row.id,
      title: row.title,
      path: row.path,
      revision: row.revision,
      hash: gold.hash,
    });
  }
  return {
    corpus,
    pdfs,
    pdfEligible: pdfs.length === wanted.length,
    model: "anthropic/claude-sonnet-5.5",
  };
}

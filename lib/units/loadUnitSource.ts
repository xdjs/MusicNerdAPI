import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { MAX_VAULT_FILE_BYTES } from "@/lib/vaultUpload/const";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import type { UnitBody, UnitSourceInput, UnitSourceKind } from "@/lib/units/types";

const PDF_FETCH_MS = 10_000;

async function fetchPdfBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(PDF_FETCH_MS);
  const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetch(url, { redirect: "error", signal: bounded, cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("PDF unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      bounded.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_VAULT_FILE_BYTES) throw new Error("PDF exceeds the vault size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Source is not a PDF");
  return bytes;
}

/** Load one source of any kind as the input `buildSourceUnits` consumes, with the revision its units are stamped with. */
export async function loadUnitSource(
  ref: { sourceKind: UnitSourceKind; sourceId: string },
  opts?: { bytes?: Uint8Array; signal?: AbortSignal },
): Promise<UnitSourceInput | null> {
  const { sourceKind, sourceId } = ref;
  if (sourceKind === "vault") {
    const [row] = await db.execute<{
      artist_id: string;
      title: string | null;
      url: string | null;
      file_path: string | null;
      content_type: string | null;
      extracted_text: string | null;
      revision: string;
    }>(
      sql`select v.artist_id, coalesce(v.title, v.file_name) as title, v.url, v.file_path, v.content_type, v.extracted_text, ${vaultSourceRevisionSql()} as revision from artist_vault_sources v where v.id = ${sourceId}::uuid`,
    );
    if (!row) return null;
    let body: UnitBody;
    if (row.content_type === "application/pdf") {
      if (opts?.bytes) body = { kind: "pdf", bytes: opts.bytes };
      else if (!row.url) throw new Error("PDF unavailable");
      else body = { kind: "pdf", bytes: await fetchPdfBytes(row.url, opts?.signal) };
    } else if (row.extracted_text === null) body = { kind: "none" };
    else if (row.content_type === "text/markdown")
      body = { kind: "markdown", text: row.extracted_text };
    else body = { kind: "plain", text: row.extracted_text };
    return {
      sourceKind,
      sourceId,
      artistId: row.artist_id,
      title: row.title,
      url: row.url,
      sourceRevision: row.revision,
      extractedTextIsNull: row.extracted_text === null,
      body,
    };
  }
  if (sourceKind === "social") {
    const [row] = await db.execute<{
      artist_id: string;
      url: string | null;
      text: string;
      revision: string;
    }>(
      sql`select s.artist_id, s.url, case when t.speech is not null then coalesce(nullif(s.caption, '') || E'\n\n', '') || t.speech else coalesce(s.caption, '') end as text, ${socialPostRevisionSql()} as revision from artist_social_posts s left join lateral (select case when s.platform = 'instagram' and s.raw->'_musicnerdTranscript'->'version' = '1'::jsonb and s.raw->'_musicnerdTranscript'->>'actor' = 'apify/instagram-reel-scraper' and jsonb_typeof(s.raw->'_musicnerdTranscript'->'text') = 'string' and btrim(s.raw->'_musicnerdTranscript'->>'text') <> '' then s.raw->'_musicnerdTranscript'->>'text' end as speech) t on true where s.id = ${sourceId}::uuid and s.is_own_post = true and s.raw->'isRepost' is distinct from 'true'::jsonb and s.raw->'isRetweet' is distinct from 'true'::jsonb`,
    );
    if (!row) return null;
    return {
      sourceKind,
      sourceId,
      artistId: row.artist_id,
      title: null,
      url: row.url,
      sourceRevision: row.revision,
      extractedTextIsNull: false,
      body: { kind: "plain", text: row.text },
    };
  }
  const [row] = await db.execute<{
    artist_id: string;
    title: string | null;
    url: string | null;
    original_text: string;
    revision: string;
  }>(
    sql`select e.artist_id, e.title, c.url, e.original_text, e.revision from artist_research_evidence e join artist_research_candidates c on c.id = e.candidate_id and c.artist_id = e.artist_id where e.id = ${sourceId}::uuid`,
  );
  if (!row) return null;
  return {
    sourceKind,
    sourceId,
    artistId: row.artist_id,
    title: row.title,
    url: row.url,
    sourceRevision: row.revision,
    extractedTextIsNull: false,
    body: { kind: "plain", text: row.original_text },
  };
}

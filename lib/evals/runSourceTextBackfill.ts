import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { readSourceText } from "@/lib/sourceExtraction/readSourceText";

export type SourceTextBackfillCounts = {
  /** Approved link documents of the artist that had no saved text when the run started. */
  missing: number;
  /** How many of them have text saved now. */
  saved: number;
  /** Characters saved in total. */
  savedChars: number;
  /** How many of the saved texts came through Tavily's extract after our fetcher was refused (#1693). */
  viaTavily: number;
  /** Fetch results by status (`ready`, `blocked`, `empty`, `unsupported`, `unavailable`, `too_large`, `error`). */
  outcomes: Record<string, number>;
  /** One `host=status` or `host=status:httpStatus` per document left without text. Hosts only: no titles, paths or text. */
  failures: string[];
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "invalid-url";
  }
};

/**
 * The source-text-backfill suite's work for one artist: fetch the page of every approved link
 * document that has no saved text, with the same reader the `source_extract` job uses
 * (`readSourceText`: our fetcher, then Tavily's extract when the site refuses it), and save the text under the same guard that job's checkpoint uses (the row
 * is still approved, has no file, has the same URL and still has no text). Documents approved before
 * the job existed (2026-10-05) were never attempted, so they have no text and neither chat path can
 * read them; this measures how many the reader can read and fills them on staging.
 *
 * @param artistId - The artist.
 * @returns Counts and, for each document left without text, its host and fetch status.
 */
export async function runSourceTextBackfill(artistId: string): Promise<SourceTextBackfillCounts> {
  const rows = await db.execute<{ id: string; url: string }>(
    sql`select id, url from artist_vault_sources where artist_id = ${artistId}::uuid and status = 'approved' and file_path is null and url is not null and coalesce(extracted_text, '') ~ '^[[:space:]]*$' order by created_at, id`,
  );
  const outcomes = new Map<string, number>();
  const failures: string[] = [];
  let saved = 0;
  let savedChars = 0;
  let viaTavily = 0;
  for (const row of rows) {
    let status = "error";
    let httpStatus: number | null = null;
    try {
      const result = await readSourceText(row.url, 15_000);
      status = result.status;
      httpStatus = result.httpStatus;
      if (result.status === "ready" && result.text?.trim()) {
        const updated = await db.execute(
          sql`update artist_vault_sources set extracted_text = ${result.text}, og_image = coalesce(nullif(btrim(og_image), ''), ${result.ogImage ?? null}), updated_at = now() where id = ${row.id}::uuid and artist_id = ${artistId}::uuid and status = 'approved' and file_path is null and url = ${row.url} and coalesce(extracted_text, '') ~ '^[[:space:]]*$' returning id`,
        );
        if (updated.length) {
          saved += 1;
          savedChars += result.text.length;
          if (result.reader === "tavily") viaTavily += 1;
        } else status = "skipped";
      }
    } catch {
      // The error can carry the URL or SQL parameters: only the fact of a failure is kept.
      status = "error";
    }
    outcomes.set(status, (outcomes.get(status) ?? 0) + 1);
    if (status !== "ready")
      failures.push(`${hostOf(row.url)}=${status}${httpStatus === null ? "" : `:${httpStatus}`}`);
  }
  return {
    missing: rows.length,
    saved,
    savedChars,
    viaTavily,
    outcomes: Object.fromEntries(outcomes),
    failures,
  };
}

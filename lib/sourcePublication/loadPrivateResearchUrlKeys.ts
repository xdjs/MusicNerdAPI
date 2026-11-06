import { sql } from "drizzle-orm";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";
import type { TransactionDb } from "@/lib/ownership/types";
import { canonicalResearchUrl } from "@/lib/questionResearch/canonicalResearchUrl";

/** Private-copy identity matches persistence, including legacy vault URL aliases. */
export async function loadPrivateResearchUrlKeys(tx: TransactionDb, artistId: string) {
  // Bound metadata before normalizing; never return a clipped URL as an identity.
  const rows = await tx.execute<{ url: string | null }>(sql`
    select left(url,2049) as url from artist_vault_sources
    where artist_id=${artistId}::uuid and publication='private'
    limit ${MAX_KNOWLEDGE_ROWS + 1}`);
  if (
    rows.length > MAX_KNOWLEDGE_ROWS ||
    rows.some(row => typeof row.url !== "string" || row.url.length > 2048) ||
    rows.reduce((n, row) => n + (row.url?.length ?? 0), 0) > MAX_KNOWLEDGE_CHARS
  )
    throw new KnowledgeError(
      "corpus_too_large",
      413,
      "Private source identity exceeds its supported bound",
    );
  return new Set(
    rows.map(row => {
      try {
        return canonicalResearchUrl(row.url!);
      } catch {
        return row.url!;
      } // Same legacy fallback used when retaining research originals.
    }),
  );
}

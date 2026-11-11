import { publicKnowledgeUrl } from "@/lib/knowledge/publicKnowledgeUrl";
import { loreSourceKey } from "@/lib/lore/loreSourceKey";
import { publicVaultSourceSql } from "@/lib/sourcePublication/publicVaultSourceSql";
import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";
import { isCitableSource } from "@/lib/sources/isCitableSource";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import type { DocSource } from "@/lib/lore/types";

/** Under the artist lock, refuse missing, removed, revised or newly eligible vault evidence. Read errors propagate. */
export async function assertLoreSourcesCurrent(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  sources: DocSource[],
  options: { summaryKey?: string; allowEmpty?: boolean } = {},
): Promise<void> {
  // Freeze source-to-event links before locking retained provenance. The private
  // helper grants only row-lock capability; eligibility remains checked as mnweb.
  await tx.execute(sql`select id from public.artist_vault_sources
    where artist_id=${artistId}::uuid order by id for share`);
  await tx.execute(sql`select mn_private.lock_lore_activity_events(${artistId}::uuid)`);
  const rows = rowsOf(
    await tx.execute(sql`
    select v.id,v.activity_id as "activityId",v.origin,v.publication,v.type,url,extracted_text as "extractedText",file_path as "filePath",status,
           title,snippet,published_at as "publishedAt"
    from artist_vault_sources v where v.artist_id=${artistId}::uuid and ${publicVaultSourceSql()} for share of v
  `),
  ) as {
    id: string;
    type: string | null;
    url: string;
    extractedText: string | null;
    filePath: string | null;
    status: string;
    title: string | null;
    snippet: string | null;
    publishedAt: string | null;
  }[];
  const eligible = rows.filter(source => publicKnowledgeUrl(source.url));
  if (options.summaryKey !== undefined && loreSourceKey(eligible) !== options.summaryKey)
    throw new LoreChangedError();
  const current = eligible.filter(isCitableSource);
  const recorded = sources.filter(s => s.kind === "vault");
  if (
    (!options.allowEmpty && !sources.length) ||
    current.length !== recorded.length ||
    current.some(s => !recorded.some(r => r.url === s.url && r.revision === vaultSourceRevision(s)))
  )
    throw new LoreChangedError();
}

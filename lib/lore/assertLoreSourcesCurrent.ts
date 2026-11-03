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
): Promise<void> {
  const rows = rowsOf(
    await tx.execute(sql`
    select url,extracted_text as "extractedText",file_path as "filePath",status,
           title,snippet,published_at as "publishedAt"
    from artist_vault_sources where artist_id=${artistId}::uuid and status='approved' for share
  `),
  ) as {
    url: string;
    extractedText: string | null;
    filePath: string | null;
    status: string;
    title: string | null;
    snippet: string | null;
    publishedAt: string | null;
  }[];
  const current = rows.filter(isCitableSource);
  const recorded = sources.filter(s => s.kind === "vault");
  if (
    !sources.length ||
    current.length !== recorded.length ||
    current.some(s => !recorded.some(r => r.url === s.url && r.revision === vaultSourceRevision(s)))
  )
    throw new LoreChangedError();
}

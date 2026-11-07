import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";

/** Check the setup input snapshot under the artist lock, before replacing Lore. */
export async function assertSetupDocumentCurrent(
  tx: ScopedWriteDb,
  artistId: string,
  expected: { content: string; sources: unknown; updatedAt: string | null } | null,
): Promise<void> {
  const rows = rowsOf(
    await tx.execute(sql`select
    ${expected !== null} and content is not distinct from ${expected?.content ?? null}
    and sources is not distinct from ${JSON.stringify(expected?.sources ?? null)}::jsonb
    and updated_at is not distinct from ${expected?.updatedAt ?? null}::timestamptz as matches
    from artist_docs where artist_id=${artistId}::uuid for update`),
  ) as { matches: boolean }[];
  if (expected ? rows.length !== 1 || !rows[0].matches : rows.length !== 0)
    throw new LoreChangedError();
}

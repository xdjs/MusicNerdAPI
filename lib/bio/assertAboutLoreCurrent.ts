import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import { assertLoreSourcesCurrent } from "@/lib/lore/assertLoreSourcesCurrent";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import type { DocSource } from "@/lib/lore/types";
import type { TransactionDb } from "@/lib/ownership/types";

/** Fence About against its exact document and current vault evidence under the artist write lock. */
export async function assertAboutLoreCurrent(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  expected: { content: string; sources: DocSource[] },
): Promise<void> {
  const rows = rowsOf(
    await tx.execute(
      sql`select content,sources from artist_docs where artist_id=${artistId}::uuid`,
    ),
  ) as { content: string; sources: DocSource[] }[];
  if (
    !rows[0] ||
    rows[0].content !== expected.content ||
    JSON.stringify(rows[0].sources) !== JSON.stringify(expected.sources)
  )
    throw new LoreChangedError();
  await assertLoreSourcesCurrent(tx, artistId, expected.sources);
}

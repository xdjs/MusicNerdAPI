import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/** Under the artist lock, allow only the original directory creation event before any claim. */
export async function assertDirectoryDiscoveryScope(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  activityId: string | undefined,
): Promise<void> {
  if (!activityId) throw new OwnershipChangedError();
  const result = await tx.execute(sql`
    select a.id from artists a
    join artist_activity_events e on e.artist_id=a.id and e.id=${activityId}::uuid
    where a.id=${artistId}::uuid and a.added_by=e.actor_user_id
      and e.actor_kind='user' and e.action='directory_add' and e.trigger='directory_add'
      and not exists(select 1 from artist_claims c where c.artist_id=a.id)
  `);
  if (!rowsOf(result).length) throw new OwnershipChangedError();
}
